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

/* DeepSeek 新闻 slug 即发布日期：2025 年起是 newsYYMMDD（news260910 → 2026-09-10），
 * 更早的是 newsMMDD（无年份，站点上这批都属于 2024 年）。
 * 页面自身取不到可信日期：正文首屏混排侧栏「最新新闻」的日期，会被误当成文章日期。 */
export function deepseekDateFromUrl(loc) {
  const six = String(loc).match(/news(\d{2})(\d{2})(\d{2})$/);
  if (six) return `20${six[1]}-${six[2]}-${six[3]}`;
  const four = String(loc).match(/news(\d{2})(\d{2})$/);
  return four ? `2024-${four[1]}-${four[2]}` : "";
}

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
  {
    name: "Meta",
    type: "rss",
    url: "https://engineering.fb.com/feed/",
    maturity: "emerging",
    tags: ["meta", "模型"],
    limit: 15,
  },
  {
    name: "Meta Muse",
    type: "manual",
    file: "data/manual/meta-muse.json",
    maturity: "emerging",
    tags: ["meta", "Agent"],
    limit: 3,
  },
  {
    name: "DeepSeek",
    type: "sitemap",
    url: "https://api-docs.deepseek.com/sitemap.xml",
    pathRe: /\/news\//,
    titleStrip: /\s*\|\s*DeepSeek API Docs\s*$/i,
    // 已下线/软 404 的新闻页会回落成文档默认页，标题固定为站点首页标题，直接丢弃
    titleExcludeRe: /^your first api call$/i,
    dateFromUrl: deepseekDateFromUrl,
    maturity: "emerging",
    tags: ["deepseek", "开源"],
    limit: 10,
  },
  {
    name: "Kimi",
    type: "manual",
    file: "data/manual/kimi.json",
    maturity: "emerging",
    tags: ["moonshot", "模型"],
    limit: 3,
  },
  {
    name: "Creao AI",
    type: "manual",
    file: "data/manual/creoai.json",
    maturity: "emerging",
    tags: ["agent", "平台"],
    limit: 3,
  },
  {
    name: "Genspark",
    type: "manual",
    file: "data/manual/genspark.json",
    maturity: "emerging",
    tags: ["agent", "搜索"],
    limit: 3,
  },
  {
    name: "Manus",
    type: "sitemap",
    url: "https://manus.im/sitemap.xml",
    pathRe: /\/blog\//,
    excludeRe: /\/blog\/(customer-stories|product)$/,
    titleStrip: /\s*\|\s*Manus\s*$/i,
    // blog 无 lastmod、页内无结构化日期：发布日期只能从 og:image 的 CDN 路径拿
    dateFromImage: true,
    // 29 篇全抓：日期未知时无法按 lastmod 预筛，漏抓就等于漏最新文章
    fetchLimit: 32,
    maturity: "emerging",
    tags: ["agent", "平台"],
    limit: 10,
  },
  {
    name: "Google Gemini",
    type: "rss",
    url: "https://blog.google/products/gemini/rss/",
    maturity: "emerging",
    tags: ["gemini", "模型"],
    limit: 15,
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

/* 取一句话：首个句子（中英标点），≤max 字 */
function firstSentence(text, max = 90) {
  const clean = cleanSummary(text, 200);
  if (!clean) return "";
  const m = clean.match(/^.*?[。！？!?]|^[^。！？!?\n]+/);
  let s = (m?.[0] ?? clean).trim();
  if (s.length > max) {
    s = `${s.slice(0, max).replace(/[，、：;；\s]+$/, "")}…`;
  }
  return s;
}

/* TLDR：一句话总结；没有任何摘要时退化为标题本身（不带任何前缀） */
function makeTldr(title, summary) {
  const sentence = firstSentence(summary);
  if (sentence) return sentence;
  return cleanSummary(title, 80) || "暂无摘要";
}

/* 抓文章摘要：正文首段优先（跳过站点导航段），meta description 兜底（过滤站点通用文案） */
async function fetchArticleSummary(url) {
  try {
    const html = await fetchWithTimeout(url, 12000);
    const NAV_START = /^(models|datasets|spaces|buckets|pricing|enterprise|docs|tasks|website|products)\b/i;
    const para = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
      .map((m) =>
        decodeEntities(m[1])
          .replace(/<[^>]+>/g, "")
          .replace(/\s+/g, " ")
          .trim(),
      )
      .find((t) => t.length >= 40 && !NAV_START.test(t));
    if (para) return cleanSummary(para, 200);
    const desc = decodeEntities(
      html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1] ??
        html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)?.[1] ??
        html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i)?.[1] ??
        "",
    );
    const clean = cleanSummary(desc, 200);
    if (clean && !/on a journey to advance|we'?re on a journey/i.test(clean)) {
      return clean;
    }
    return "";
  } catch {
    return "";
  }
}

/* 解析 sitemap：提取文章 URL + lastmod；pathRe 可逐源定制（如 Manus 的 /blog/、DeepSeek 的 /news/） */
export function parseSitemap(xml, pathRe = /\/news\/|\/engineering\//) {
  const pairs = [];
  const blocks = xml.match(/<url>[\s\S]*?<\/url>/g) ?? [];
  for (const block of blocks) {
    const loc = block.match(/<loc>([^<]+)<\/loc>/)?.[1] ?? "";
    if (!pathRe.test(loc)) continue;
    const lastmod = block.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1] ?? "";
    pairs.push({ loc, lastmod });
  }
  return pairs;
}

/* 文章页内日期提取：优先 article:published_time meta，其次逐源 dateRe（如 DeepSeek 页首的 YYYY/MM/DD） */
function extractDateFromHtml(html, dateRe) {
  if (!html) return "";
  const meta = html.match(
    /<meta[^>]*property=["']article:published_time["'][^>]*content=["']([^"']+)/i,
  );
  if (meta?.[1]) return normalizeDate(meta[1]);
  if (dateRe) {
    const m = html.match(dateRe);
    if (m?.[1] && m[2] && m[3]) {
      return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
    }
  }
  return "";
}

/* 封面 CDN 路径常带发布日（manuscdn .../materials/2025/10/16/<hash>.webp）；
 * 站点既无 lastmod 也无结构化日期时的最后一条可靠线索 */
export function dateFromImageUrl(url) {
  const m = String(url ?? "").match(/\/(20\d{2})\/(\d{2})\/(\d{2})\//);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

/* 实在取不到日期时的兜底：显式告警。静默写「今天」会让条目永久霸占榜单首位，
 * 而 400 条滚动上限只淘汰日期最旧的，永远淘汰不到它们。 */
function unknownDateFallback(sourceName, url) {
  console.error(`[date?] ${sourceName}: no date found, falling back to today: ${url}`);
  return new Date().toISOString().slice(0, 10);
}

/* 手动策展源：读取 data/manual/<file>.json（数组），按 URL 规范化后进入统一合并流程 */
export async function fetchManual(source) {
  const file = join(__dirname, "..", source.file);
  let raw = [];
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    console.error(`[skip] ${source.name}: manual file unreadable: ${err.message}`);
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const items = [];
  for (const it of raw.slice(0, source.limit)) {
    const url = normalizeUrl(it.url);
    const title = String(it.title ?? "").trim();
    if (!url || !title) continue;
    const summary = cleanSummary(it.summary ?? "");
    items.push({
      id: hashId(url),
      title,
      source: source.name,
      url,
      date: normalizeDate(it.date) || unknownDateFallback(source.name, url),
      summary,
      cover: /^https?:/i.test(it.cover ?? "") ? it.cover : undefined,
      tldr: makeTldr(title, summary),
      maturity: it.maturity ?? source.maturity,
      tags:
        Array.isArray(it.tags) && it.tags.length > 0
          ? it.tags
          : inferTags(title, summary),
      pinned: true, // 策展条目不被 400 条滚动上限挤掉
      addedAt: new Date().toISOString(),
    });
  }
  return items;
}

/* Anthropic 无公开 RSS：sitemap 取最新文章，逐篇抓 title + description；日期优先 lastmod，其次页内日期，最后回退今天 */
async function fetchSitemapArticles(source, xml) {
  const pairs = parseSitemap(xml, source.pathRe)
    .filter((p) => !source.excludeRe?.test(p.loc))
    // lastmod 缺失时不能返回 -1：比较器不自洽会让预筛顺序随机，可能丢掉最新文章
    .sort((a, b) => (a.lastmod < b.lastmod ? 1 : a.lastmod > b.lastmod ? -1 : 0))
    .slice(0, source.fetchLimit ?? source.limit * 2);
  const items = [];
  for (const { loc, lastmod } of pairs) {
    await new Promise((resolve) => setTimeout(resolve, 250)); // 限速，避免触发风控
    try {
      const html = await fetchWithTimeout(loc, 12000);
      const title = decodeEntities(
        html.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] ?? "",
      )
        .replace(source.titleStrip ?? /\s*[|\\]\s*Anthropic\s*$/i, "")
        .replace(/\s+/g, " ")
        .trim();
      // 软 404 / 已下线文章会回落成站点默认页，标题是同一句站点标语 → 不是文章
      if (source.titleExcludeRe?.test(title)) {
        console.error(`[skip] article ${loc}: generic page title "${title}"`);
        continue;
      }
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
        date:
          normalizeDate(lastmod) ||
          (source.dateFromUrl ? source.dateFromUrl(loc) : "") ||
          extractDateFromHtml(html, source.dateRe) ||
          (source.dateFromImage ? dateFromImageUrl(cover) : "") ||
          unknownDateFallback(source.name, loc),
        summary,
        cover: /^https?:/i.test(cover) ? cover : undefined,
        tldr: makeTldr(title, summary),
        maturity: source.maturity,
        tags: inferTags(title, summary),
        addedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error(`[skip] article ${loc}: ${err.message}`);
    }
  }
  // sitemap 常缺 lastmod（如 Manus / DeepSeek）：先抓再按实际日期倒序，取最新 limit 条
  items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return items.slice(0, source.limit);
}

async function fetchSource(source) {
  if (source.type === "manual") return fetchManual(source);
  const raw = await fetchWithTimeout(source.url);
  if (source.type === "sitemap") {
    return fetchSitemapArticles(source, raw);
  }
  const parsed = (source.type === "arxiv" ? parseArxiv(raw) : parseFeed(raw)).slice(
    0,
    source.limit,
  );
  const items = [];
  for (const item of parsed) {
    const url = normalizeUrl(item.link);
    let summary = source.type === "arxiv" ? item.summary : cleanSummary(item.summary);
    // RSS 无摘要时抓文章正文首句（meta description / 首段）
    if (source.type === "rss" && !summary) {
      const body = await fetchArticleSummary(url);
      if (body) summary = body;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    items.push({
      id: hashId(url),
      title: item.title,
      source: source.name,
      url,
      date: normalizeDate(item.date) || unknownDateFallback(source.name, url),
      summary,
      cover: source.type === "rss" && item.image ? item.image : undefined,
      tldr: makeTldr(item.title, summary),
      maturity: source.maturity,
      tags: inferTags(item.title, summary),
      addedAt: new Date().toISOString(),
    });
  }
  return items;
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
    const pinned = Boolean(current.pinned || item.pinned);
    byUrl.set(url, {
      ...current,
      tags,
      title: current.title || item.title || current.title,
      // 摘要为自动抓取产物：新抓取（含正文首段）优先刷新
      summary: item.summary || current.summary || "",
      // 日期以新抓取为准（解析逻辑迭代后更可靠），旧值兜底
      date: item.date || current.date || "",
      // 缺失字段（封面）用新抓取补全；tldr 是自动生成的，新抓取优先刷新
      cover: current.cover ?? item.cover,
      tldr: item.tldr ?? current.tldr,
      // 策展标记必须显式合并：老库里没有该字段，只靠 ...current 会让已入库的策展条目丢掉钉住资格
      ...(pinned ? { pinned: true } : {}),
    });
  }
  return [...byUrl.values()];
}

/* 历史条目就地校正。合并只做「新增/刷新」，不会撤销上一轮写错的条目；
 * 而错误日期若被写成「今天」，就会永久排在 400 条滚动上限的队首，永远淘汰不掉。
 * 这里用当前来源规则回头修正老库：
 *   1) 标题命中 titleExcludeRe 的（软 404 回落页）不是文章 → 剔除；
 *   2) slug / 封面 CDN 路径里带发布日的来源 → 用规则值覆盖历史错值（页面内日期会被侧栏污染）。 */
export function reconcileExisting(concepts, sources) {
  const byName = new Map(sources.map((s) => [s.name, s]));
  const kept = [];
  let pruned = 0;
  let retouched = 0;
  for (const c of concepts) {
    const src = byName.get(c.source);
    if (!src) {
      kept.push(c);
      continue;
    }
    if (!c.pinned && src.titleExcludeRe?.test(c.title ?? "")) {
      pruned += 1;
      continue;
    }
    const url = normalizeUrl(c.url) || c.url;
    const authoritative =
      (src.dateFromUrl ? src.dateFromUrl(url) : "") ||
      (src.dateFromImage ? dateFromImageUrl(c.cover) : "");
    if (authoritative && authoritative !== c.date) {
      kept.push({ ...c, date: authoritative });
      retouched += 1;
      continue;
    }
    kept.push(c);
  }
  return { concepts: kept, pruned, retouched };
}

/* 容量上限（cap 条）的名额分配：
 *   1) 策展条目（pinned）永不淘汰；
 *   2) 每个来源保底保留最新 limit 条 —— limit 同时是「抓多少」和「保底留多少」。
 *      只按全局日期倒序裁的话，低频来源（Manus / DeepSeek / Kimi）会被 arXiv 与大厂 feed
 *      的高频条目整体挤出窗口，等于这个来源白接了；
 *   3) 剩余名额按全局日期倒序填满。 */
export function selectCapped(merged, sources, cap = 400) {
  const byDateDesc = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
  const pinned = merged.filter((c) => c.pinned);
  const rest = merged.filter((c) => !c.pinned).sort(byDateDesc);
  const quota = Math.max(0, cap - pinned.length);
  const selected = new Map();
  for (const source of sources) {
    if (selected.size >= quota) break;
    for (const c of rest.filter((x) => x.source === source.name).slice(0, source.limit)) {
      if (selected.size >= quota) break;
      selected.set(c.url, c);
    }
  }
  for (const c of rest) {
    if (selected.size >= quota) break;
    selected.set(c.url, c);
  }
  // 整体仍按日期倒序：保底与策展标记只决定「留不留」，不改变账本的时间顺序
  return [...pinned, ...selected.values()].sort(byDateDesc);
}

async function main() {
  const loaded = loadExisting();
  const { concepts: existing, pruned, retouched } = reconcileExisting(loaded.concepts, SOURCES);
  const version = loaded.version;

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
  // TLDR 纯自动生成：每次全量重算（用最新 summary），无需保留旧值
  for (const c of merged) {
    c.tldr = makeTldr(c.title, c.summary);
  }
  const byDateDesc = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
  merged.sort(byDateDesc);

  const capped = selectCapped(merged, SOURCES);

  // 版本记号 = 新出现过的 URL 数。库里长期处于 400 条满编，用「总数变多」判断会让版本号永久停住，
  // 前端「自上次访问新增 N 个」就永远显示 0
  const knownUrls = new Set(existing.map((c) => normalizeUrl(c.url) || c.url));
  const added = capped.filter((c) => !knownUrls.has(normalizeUrl(c.url) || c.url)).length;
  const data = {
    updatedAt: new Date().toISOString(),
    version: added > 0 ? version + 1 : version,
    sourceCount: SOURCES.length,
    conceptCount: capped.length,
    concepts: capped,
  };
  mkdirSync(dirname(DATA_PATH), { recursive: true });
  writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + "\n");

  const pinnedCount = capped.filter((c) => c.pinned).length;
  console.log(
    `sources ok: ${SOURCES.length - failed}/${SOURCES.length}, items: ${fetched}, total: ${capped.length}, pinned: ${pinnedCount}, added: ${added}, reconciled: -${pruned}/~${retouched}`,
  );
  if (added > 0) console.log("CHANGED");
  process.exit(0);
}

// 仅作为脚本直接运行时执行；被测试 import 时只导出纯函数，不碰网络与磁盘
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    console.error("ingest failed:", err.message);
    process.exit(1);
  });
}
