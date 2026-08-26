#!/usr/bin/env node
/**
 * 前沿概念抓取脚本（GitHub Actions 定时运行）
 *
 * 抓取一手来源（RSS / arXiv API），解析出概念条目，
 * 与 data/concepts.json 按规范化 URL 去重合并，写回仓库。
 * 有新增时控制台输出 CHANGED，供 workflow 判断是否提交。
 *
 * 运行：node scripts/ingest.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, "..", "data", "concepts.json");

/* 来源清单：type = rss | arxiv | sitemap */
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
    name: "Anthropic",
    type: "sitemap",
    url: "https://www.anthropic.com/sitemap.xml",
    maturity: "emerging",
    tags: ["anthropic", "模型"],
    limit: 15,
  },
  {
    name: "Google DeepMind",
    type: "rss",
    url: "https://deepmind.google/blog/rss.xml",
    maturity: "emerging",
    tags: ["deepmind", "模型"],
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

/* 解码常见 HTML 实体（RSS/Atom 标题与摘要里的常见转义） */
const NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  copy: "©",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};

function fromCodePointSafe(code) {
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

/* 解码命名与数字 HTML 实体；未知实体原样保留 */
export function decodeEntities(str = "") {
  return String(str)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => fromCodePointSafe(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => fromCodePointSafe(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (match, name) => NAMED_ENTITIES[name.toLowerCase()] ?? match);
}

/* 摘要清洗：去 HTML、解码实体、截断 */
function cleanSummary(raw, max = 220) {
  if (!raw) return "";
  const text = decodeEntities(raw)
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

/* 常见跟踪参数：同一文章带不同参数会绕过 URL 去重 */
const TRACKING_PARAMS = /^(fbclid|gclid|yclid|igshid|mc_cid|mc_eid|ref|source|from)$/i;

function isTrackingParam(key) {
  return key.toLowerCase().startsWith("utm_") || TRACKING_PARAMS.test(key);
}
const ARXIV_RE = /arxiv\.org\/(?:abs|pdf)\/([\w.-]+)/i;

/* URL 规范化：arXiv 统一到 abs 页；去掉跟踪参数与锚点，保证按 URL 去重可靠 */
export function normalizeUrl(raw) {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return "";
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return trimmed;
  }
  const arxiv = ARXIV_RE.exec(url.href);
  if (arxiv) return `https://arxiv.org/abs/${arxiv[1]}`;
  for (const key of [...url.searchParams.keys()]) {
    if (isTrackingParam(key)) url.searchParams.delete(key);
  }
  url.hash = "";
  return url.href;
}

/* 条目内首选链接：Atom 优先 rel=alternate / text/html，再回退到第一个带 href 的 link */
function firstHref(block) {
  for (const re of [
    /<link[^>]*rel=["']?alternate["']?[^>]*>/gi,
    /<link[^>]*type=["']text\/html["'][^>]*>/gi,
  ]) {
    for (const link of block.match(re) ?? []) {
      const href = link.match(/href=["']([^"']+)["']/i)?.[1];
      if (href) return href;
    }
  }
  return (
    block.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1] ??
    block.match(/<link[^>]*>([\s\S]*?)<\/link>/)?.[1] ??
    ""
  );
}

/* 条目封面：RSS 里的 enclosure / media: / itunes:image（仅接受 http(s)） */
function extractImage(block) {
  const patterns = [
    /<enclosure[^>]*url=["']([^"']+)["'][^>]*type=["']image\/[^"']+["']/i,
    /<enclosure[^>]*type=["']image\/[^"']+["'][^>]*url=["']([^"']+)["']/i,
    /<media:thumbnail[^>]*url=["']([^"']+)["']/i,
    /<media:content[^>]*url=["']([^"']+)["'][^>]*type=["']image\/[^"']+["']/i,
    /<media:content[^>]*type=["']image\/[^"']+["'][^>]*url=["']([^"']+)["']/i,
    /<itunes:image[^>]*href=["']([^"']+)["']/i,
  ];
  for (const re of patterns) {
    const m = block.match(re);
    if (m?.[1] && /^https?:/i.test(m[1])) return m[1];
  }
  return "";
}

/* 解析 RSS/Atom（正则粗解析，够用；标题/摘要做实体解码） */
export function parseFeed(xml) {
  const items = [];
  const blocks = xml.match(/<(?:item|entry)[\s\S]*?<\/(?:item|entry)>/g) ?? [];
  for (const block of blocks) {
    const title = decodeEntities(
      block.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] ?? "",
    )
      .replace(/<!\[CDATA\[|\]\]>/g, "")
      .trim();
    const link = firstHref(block);
    const date =
      block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/)?.[1] ??
      block.match(/<published[^>]*>([\s\S]*?)<\/published>/)?.[1] ??
      block.match(/<updated[^>]*>([\s\S]*?)<\/updated>/)?.[1] ??
      "";
    const summary = decodeEntities(
      block.match(/<description[^>]*>([\s\S]*?)<\/description>/)?.[1] ??
        block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/)?.[1] ??
        "",
    );
    if (!title || !link) continue;
    items.push({ title, link, date, summary, image: extractImage(block) });
  }
  return items;
}

/* 解析 arXiv Atom */
export function parseArxiv(xml) {
  const items = [];
  const blocks = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
  for (const block of blocks) {
    const title = decodeEntities(
      block.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] ?? "",
    )
      .replace(/\s+/g, " ")
      .trim();
    const link = normalizeUrl(block.match(/<id[^>]*>([\s\S]*?)<\/id>/)?.[1] ?? "");
    const date = block.match(/<published[^>]*>([\s\S]*?)<\/published>/)?.[1] ?? "";
    const summary = cleanSummary(
      block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/)?.[1] ?? "",
    );
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
  ["agent client protocol", "ACP"],
  ["acp", "ACP"],
  ["stdio agent", "CLI"],
  ["codex cli", "CLI"],
  ["grok cli", "CLI"],
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

/* 日期统一为 YYYY-MM-DD；解析失败返回空串（由调用方兜底为今天） */
function normalizeDate(raw) {
  if (!raw) return "";
  try {
    return new Date(raw).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

/* TLDR：摘要精简到 ~90 字；空摘要时用来源兜底 */
function makeTldr(title, summary, source) {
  const clean = cleanSummary(summary, 160);
  if (clean) {
    return clean.length > 90
      ? `${clean.slice(0, 90).replace(/[。，、；：\s]+$/, "")}…`
      : clean;
  }
  return `来自 ${source} 的官方技术文章：${title.slice(0, 60)}…`;
}

/* 解析 sitemap：提取 news/engineering 文章 URL + lastmod */
export function parseSitemap(xml) {
  const pairs = [];
  const blocks = xml.match(/<url>[\s\S]*?<\/url>/g) ?? [];
  for (const block of blocks) {
    const loc = block.match(/<loc>([^<]+)<\/loc>/)?.[1] ?? "";
    if (!/\/news\/|\/engineering\//.test(loc)) continue;
    const lastmod = block.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1] ?? "";
    pairs.push({ loc, lastmod });
  }
  return pairs;
}

/* Anthropic 无公开 RSS：sitemap 取最新文章，逐篇抓 title + description */
async function fetchSitemapArticles(source, xml) {
  const pairs = parseSitemap(xml)
    .sort((a, b) => (a.lastmod < b.lastmod ? 1 : -1))
    .slice(0, source.limit);
  const items = [];
  for (const { loc, lastmod } of pairs) {
    await new Promise((resolve) => setTimeout(resolve, 250)); // 限速，避免触发风控
    try {
      const html = await fetchWithTimeout(loc, 12000);
      const title = decodeEntities(
        html.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] ?? "",
      )
        .replace(/\s*[|\\]\s*Anthropic\s*$/i, "")
        .replace(/\s+/g, " ")
        .trim();
      const desc = decodeEntities(
        html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "",
      );
      const cover = (
        html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1] ??
        html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i)?.[1] ??
        ""
      ).trim();
      const url = normalizeUrl(loc);
      const summary = cleanSummary(desc);
      items.push({
        id: hashId(url),
        title,
        source: source.name,
        url,
        date: normalizeDate(lastmod) || new Date().toISOString().slice(0, 10),
        summary,
        cover: /^https?:/i.test(cover) ? cover : undefined,
        tldr: makeTldr(title, summary, source.name),
        maturity: source.maturity,
        tags: inferTags(title, summary),
        addedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error(`[skip] article ${loc}: ${err.message}`);
    }
  }
  return items;
}

async function fetchSource(source) {
  const raw = await fetchWithTimeout(source.url);
  if (source.type === "sitemap") {
    return fetchSitemapArticles(source, raw);
  }
  const parsed = source.type === "arxiv" ? parseArxiv(raw) : parseFeed(raw);
  return parsed.slice(0, source.limit).map((item) => {
    const url = normalizeUrl(item.link);
    const summary =
      source.type === "arxiv" ? item.summary : cleanSummary(item.summary);
    return {
      id: hashId(url),
      title: item.title,
      source: source.name,
      url,
      date: normalizeDate(item.date) || new Date().toISOString().slice(0, 10),
      summary,
      cover:
        source.type === "rss" && item.image ? item.image : undefined,
      tldr: makeTldr(item.title, summary, source.name),
      maturity: source.maturity,
      tags: inferTags(item.title, summary),
      addedAt: new Date().toISOString(),
    };
  });
}

function loadExisting() {
  try {
    const data = JSON.parse(readFileSync(DATA_PATH, "utf8"));
    return {
      concepts: Array.isArray(data.concepts) ? data.concepts : [],
      version: data.version ?? 0,
    };
  } catch {
    return { concepts: [], version: 0 };
  }
}

/* 按规范化 URL 合并：新 URL 直接入库；同 URL 条目补全 tags 与缺失字段，保留原 addedAt */
export function mergeItems(existing, fetched) {
  const byUrl = new Map();
  for (const item of [...existing, ...fetched]) {
    const url = normalizeUrl(item.url) || item.url;
    const normalized = { ...item, url };
    const current = byUrl.get(url);
    if (!current) {
      byUrl.set(url, normalized);
      continue;
    }
    const tags = [...new Set([...(current.tags ?? []), ...(item.tags ?? [])])];
    byUrl.set(url, {
      ...current,
      tags,
      title: current.title || item.title || current.title,
      summary: current.summary || item.summary || current.summary,
      // 缺失字段（封面/TLDR）用新抓取补全，保留人工修正过的旧值
      cover: current.cover ?? item.cover,
      tldr: current.tldr ?? item.tldr,
    });
  }
  return [...byUrl.values()];
}

async function main() {
  const { concepts: existing, version } = loadExisting();

  let fetched = 0;
  let failed = 0;
  const collected = [];
  for (const source of SOURCES) {
    try {
      const items = await fetchSource(source);
      fetched += items.length;
      collected.push(...items);
    } catch (err) {
      failed += 1;
      console.error(`[skip] ${source.name}: ${err.message}`);
    }
  }

  const merged = mergeItems(existing, collected);
  // 历史条目补全 TLDR（封面无法回填，前端用占位图兜底）
  for (const c of merged) {
    if (!c.tldr) c.tldr = makeTldr(c.title, c.summary, c.source);
  }
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

  console.log(
    `sources ok: ${SOURCES.length - failed}/${SOURCES.length}, items: ${fetched}, total: ${capped.length}, new: ${isNew ? "yes" : "no"}`,
  );
  if (isNew) console.log("CHANGED");
  process.exit(0);
}

// 仅作为脚本直接运行时执行；被测试 import 时只导出纯函数，不碰网络与磁盘
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    console.error("ingest failed:", err.message);
    process.exit(1);
  });
}
