#!/usr/bin/env node
/**
 * 前沿概念抓取脚本（GitHub Actions 定时运行）
 *
 * 抓取一手来源（RSS / arXiv API），解析出概念条目，
 * 与 data/concepts.json 按 URL 去重合并，写回仓库。
 * 有新增时退出码 0 且控制台输出 CHANGED，供 workflow 判断是否提交。
 *
 * 运行：node scripts/ingest.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, "..", "data", "concepts.json");

/* 来源清单：type = rss | arxiv */
const SOURCES = [
  {
    name: "OpenAI",
    type: "rss",
    url: "https://openai.com/news/rss.xml",
    maturity: "emerging",
    tags: ["openai", "模型"],
    limit: 15,
  },
  {
    name: "Google AI Blog",
    type: "rss",
    url: "https://blog.google/technology/ai/rss/",
    maturity: "emerging",
    tags: ["google", "模型"],
    limit: 15,
  },
  {
    name: "Hugging Face",
    type: "rss",
    url: "https://huggingface.co/blog/feed.xml",
    maturity: "emerging",
    tags: ["huggingface", "开源"],
    limit: 15,
  },
  {
    name: "arXiv AI",
    type: "arxiv",
    url: "https://export.arxiv.org/api/query?search_query=cat:cs.AI+OR+cat:cs.CL&sortBy=submittedDate&sortOrder=descending&max_results=20",
    maturity: "proposed",
    tags: ["论文"],
    limit: 20,
  },
];

/* 摘要清洗：去 HTML、截断 */
function cleanSummary(raw, max = 220) {
  if (!raw) return "";
  const text = raw
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/* 简单哈希生成稳定 id */
function hashId(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

/* 解析 RSS/Atom（正则粗解析，够用） */
function parseFeed(xml) {
  const items = [];
  // RSS <item> 或 Atom <entry>
  const blocks = xml.match(/<(?:item|entry)[\s\S]*?<\/(?:item|entry)>/g) ?? [];
  for (const block of blocks) {
    const title = block.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] ?? "";
    const link =
      block.match(/<link[^>]*href="([^"]+)"/)?.[1] ??
      block.match(/<link[^>]*>([\s\S]*?)<\/link>/)?.[1] ??
      "";
    const date =
      block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/)?.[1] ??
      block.match(/<published[^>]*>([\s\S]*?)<\/published>/)?.[1] ??
      block.match(/<updated[^>]*>([\s\S]*?)<\/updated>/)?.[1] ??
      "";
    const summary =
      block.match(/<description[^>]*>([\s\S]*?)<\/description>/)?.[1] ??
      block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/)?.[1] ??
      "";
    const cleanTitle = title.replace(/<!\[CDATA\[|\]\]>/g, "").trim();
    if (!cleanTitle || !link) continue;
    items.push({ title: cleanTitle, link, date, summary });
  }
  return items;
}

/* 解析 arXiv Atom */
function parseArxiv(xml) {
  const items = [];
  const blocks = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
  for (const block of blocks) {
    const title =
      block.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1]?.replace(/\s+/g, " ").trim() ?? "";
    const link = block.match(/<id[^>]*>([\s\S]*?)<\/id>/)?.[1] ?? "";
    const date = block.match(/<published[^>]*>([\s\S]*?)<\/published>/)?.[1] ?? "";
    const summary = cleanSummary(block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/)?.[1] ?? "");
    if (!title || !link) continue;
    items.push({ title, link, date, summary });
  }
  return items;
}

/* 关键词 → 概念标签（可扩展） */
const KEYWORD_TAGS = [
  ["agent", "Agent"],
  ["harness", "Harness"],
  ["loop", "Loop"],
  ["graph", "Graph"],
  ["mcp", "MCP"],
  ["a2a", "A2A"],
  ["skill", "Skill"],
  ["tool use", "Tool Use"],
  ["reasoning", "推理"],
  ["multi-agent", "Multi-Agent"],
  ["world model", "世界模型"],
  ["open source", "开源"],
  ["benchmark", "评测"],
  ["safety", "安全"],
  ["vision", "多模态"],
  ["jailbreak", "越狱"],
];

function inferTags(title, summary) {
  const text = `${title} ${summary}`.toLowerCase();
  const found = new Set();
  for (const [kw, tag] of KEYWORD_TAGS) {
    if (text.includes(kw)) found.add(tag);
  }
  if (found.size === 0) found.add("前沿");
  return [...found];
}

async function fetchWithTimeout(url, ms = 15000) {
  const attempt = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "AI-Learning-Lab-ingest/1.0" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      return await res.text();
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    return await attempt();
  } catch {
    // 一次性重试，容忍代理/网络瞬时失败
    return await attempt();
  }
}

async function fetchSource(source) {
  const raw = await fetchWithTimeout(source.url);
  const parsed =
    source.type === "arxiv" ? parseArxiv(raw) : parseFeed(raw);
  return parsed.slice(0, source.limit).map((item) => {
    const date = item.date ? new Date(item.date).toISOString().slice(0, 10) : "";
    const summary = source.type === "arxiv" ? item.summary : cleanSummary(item.summary);
    return {
      id: hashId(item.link),
      title: item.title,
      source: source.name,
      url: item.link,
      date: date || new Date().toISOString().slice(0, 10),
      summary,
      maturity: source.maturity,
      tags: inferTags(item.title, summary),
      addedAt: new Date().toISOString(),
    };
  });
}

function loadExisting() {
  try {
    const data = JSON.parse(readFileSync(DATA_PATH, "utf8"));
    return { concepts: Array.isArray(data.concepts) ? data.concepts : [], version: data.version ?? 0 };
  } catch {
    return { concepts: [], version: 0 };
  }
}

async function main() {
  const { concepts: existing, version } = loadExisting();
  const byUrl = new Map(existing.map((c) => [c.url, c]));

  let fetched = 0;
  let failed = 0;
  for (const source of SOURCES) {
    try {
      const items = await fetchSource(source);
      fetched += items.length;
      for (const item of items) {
        // 跳过已有 URL，避免重复；保留已有条目的 tags（可被新数据增强）
        if (!byUrl.has(item.url)) byUrl.set(item.url, item);
      }
    } catch (err) {
      failed += 1;
      console.error(`[skip] ${source.name}: ${err.message}`);
    }
  }

  // 已有条目：若有抓取到同 URL 的新信息，合并 tags
  const merged = [...byUrl.values()].map((c) => c);
  // 按 date 倒序（最新在前），再按 addedAt 倒序
  merged.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  // 容量上限
  const capped = merged.slice(0, 400);

  const isNew = capped.length > existing.length;
  const data = {
    updatedAt: new Date().toISOString(),
    version: isNew ? version + 1 : version,
    sourceCount: SOURCES.length,
    conceptCount: capped.length,
    concepts: capped,
  };
  mkdirSync(dirname(DATA_PATH), { recursive: true });
  writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + "\n");

  console.log(`sources ok: ${SOURCES.length - failed}/${SOURCES.length}, items: ${fetched}, total: ${capped.length}, new: ${isNew ? "yes" : "no"}`);
  if (isNew) console.log("CHANGED");
  process.exit(0);
}

main().catch((err) => {
  console.error("ingest failed:", err.message);
  process.exit(1);
});
