import assert from "node:assert/strict";
import test from "node:test";

import {
  dateFromImageUrl,
  decodeEntities,
  deepseekDateFromUrl,
  fetchManual,
  mergeItems,
  normalizeUrl,
  parseArxiv,
  parseFeed,
  parseSitemap,
  reconcileExisting,
  selectCapped,
} from "../scripts/ingest.mjs";

test("decodeEntities decodes named and numeric HTML entities", () => {
  assert.equal(
    decodeEntities("Tom &amp; Jerry &#38; friends &lt;3 &quot;hi&quot;"),
    "Tom & Jerry & friends <3 \"hi\"",
  );
});

test("normalizeUrl strips common tracking parameters", () => {
  assert.equal(
    normalizeUrl("https://openai.com/index/harness-engineering/?utm_source=rss&utm_medium=feed&ref=abc"),
    "https://openai.com/index/harness-engineering/",
  );
});

test("normalizeUrl canonicalizes arXiv abs/pdf links", () => {
  assert.equal(
    normalizeUrl("http://arxiv.org/pdf/2501.12345v1"),
    "https://arxiv.org/abs/2501.12345v1",
  );
  assert.equal(
    normalizeUrl("https://arxiv.org/abs/2501.12345v1"),
    "https://arxiv.org/abs/2501.12345v1",
  );
});

test("parseFeed decodes CDATA and entities and picks the alternate link", () => {
  const xml = `<?xml version="1.0"?><rss><channel>
    <item>
      <title><![CDATA[Harness &amp; Loop Engineering]]></title>
      <link>https://example.com/post</link>
      <pubDate>Tue, 20 Aug 2026 12:00:00 GMT</pubDate>
      <description>&lt;p&gt;A summary with &amp; entities&lt;/p&gt;</description>
    </item>
  </channel></rss>`;
  const items = parseFeed(xml);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Harness & Loop Engineering");
  assert.match(items[0].summary, /A summary with & entities/);
});

test("parseArxiv parses an Atom entry into canonical URL and cleaned summary", () => {
  const xml = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
    <entry>
      <id>http://arxiv.org/abs/2501.12345v1</id>
      <title>Multi-Agent Coordination &amp; Loops</title>
      <published>2026-08-01T00:00:00Z</published>
      <summary>We study &lt;i&gt;agent loops&lt;/i&gt; with benchmarks.</summary>
    </entry>
  </feed>`;
  const items = parseArxiv(xml);
  assert.equal(items.length, 1);
  assert.equal(items[0].link, "https://arxiv.org/abs/2501.12345v1");
  assert.equal(items[0].title, "Multi-Agent Coordination & Loops");
  assert.doesNotMatch(items[0].summary, /<i>/);
});

test("parseSitemap filters by per-source pathRe and defaults to news/engineering", () => {
  const xml = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url><loc>https://example.com/news/post-1</loc><lastmod>2026-09-01</lastmod></url>
    <url><loc>https://example.com/blog/post-2</loc><lastmod>2026-09-02</lastmod></url>
    <url><loc>https://example.com/docs/page</loc><lastmod>2026-09-03</lastmod></url>
  </urlset>`;
  assert.deepEqual(
    parseSitemap(xml, /\/blog\//).map((p) => p.loc),
    ["https://example.com/blog/post-2"],
  );
  assert.deepEqual(
    parseSitemap(xml).map((p) => p.loc),
    ["https://example.com/news/post-1"],
  );
});

test("fetchManual normalizes curated entries with source name and tags", async () => {
  const source = {
    name: "Sample Source",
    type: "manual",
    file: "tests/fixtures/manual-sample.json",
    maturity: "emerging",
    tags: ["样例"],
    limit: 3,
  };
  const items = await fetchManual(source);
  assert.equal(items.length, 1);
  const item = items[0];
  assert.equal(item.title, "Sample Curated Article");
  assert.equal(item.source, "Sample Source");
  assert.equal(item.url, "https://example.com/curated/1");
  assert.equal(item.date, "2026-09-01");
  assert.equal(item.maturity, "emerging");
  assert.deepEqual(item.tags, ["Agent", "前沿"]);
  assert.equal(item.pinned, true);
  assert.ok(item.id && typeof item.id === "string");
  assert.ok(item.addedAt);
});

test("deepseekDateFromUrl reads YYMMDD and yearless MMDD news slugs", () => {
  assert.equal(
    deepseekDateFromUrl("https://api-docs.deepseek.com/news/news260910"),
    "2026-09-10",
  );
  // 2025 年以前的 slug 不带年份，站点上这批都属于 2024 年
  assert.equal(
    deepseekDateFromUrl("https://api-docs.deepseek.com/news/news0725"),
    "2024-07-25",
  );
  assert.equal(deepseekDateFromUrl("https://api-docs.deepseek.com/quick_start"), "");
});

test("dateFromImageUrl reads the publish date out of CDN cover paths", () => {
  assert.equal(
    dateFromImageUrl(
      "https://files.manuscdn.com/assets/dashboard/materials/2025/10/16/00f66dd6.webp",
    ),
    "2025-10-16",
  );
  assert.equal(dateFromImageUrl("https://api-docs.deepseek.com/img/deepseek-social-card.jpeg"), "");
  assert.equal(dateFromImageUrl(""), "");
});

test("mergeItems keeps the pinned flag when the stored entry predates it", () => {
  const existing = [
    {
      id: "c1",
      title: "Curated",
      source: "Kimi",
      url: "https://example.com/curated",
      date: "2026-07-17",
      summary: "",
      maturity: "emerging",
      tags: ["模型"],
      addedAt: "2026-07-17T00:00:00.000Z",
    },
  ];
  const fetched = [
    {
      id: "c2",
      title: "Curated",
      source: "Kimi",
      url: "https://example.com/curated",
      date: "2026-07-17",
      summary: "S",
      maturity: "emerging",
      tags: ["模型"],
      pinned: true,
      addedAt: "2026-07-18T00:00:00.000Z",
    },
  ];
  const merged = mergeItems(existing, fetched);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].pinned, true);
  assert.equal(merged[0].addedAt, "2026-07-17T00:00:00.000Z");
  // 非策展条目不应被写上 pinned：false（400 条里绝大多数条目不该多一个冗余字段）
  const plain = mergeItems([], [{ ...fetched[0], pinned: undefined }])[0];
  assert.equal(plain.pinned, undefined);
  assert.equal(JSON.stringify(plain).includes('"pinned"'), false);
});

test("reconcileExisting drops soft-404 shells and restores rule-derived dates", () => {
  const sources = [
    {
      name: "DeepSeek",
      type: "sitemap",
      pathRe: /\/news\//,
      titleExcludeRe: /^your first api call$/i,
      dateFromUrl: deepseekDateFromUrl,
    },
    { name: "Manus", type: "sitemap", dateFromImage: true },
  ];
  const existing = [
    {
      source: "DeepSeek",
      title: "Your First API Call",
      url: "https://api-docs.deepseek.com/news/news1226",
      date: "2026-09-24",
    },
    {
      source: "DeepSeek",
      title: "DeepSeek API Upgrade",
      url: "https://api-docs.deepseek.com/news/news0725",
      date: "2026-09-24",
    },
    {
      source: "Manus",
      title: "Introducing Manus 1.5",
      url: "https://manus.im/blog/manus-1.5-release",
      date: "2026-09-24",
      cover: "https://files.manuscdn.com/assets/dashboard/materials/2025/10/16/abc.webp",
    },
    // 未在来源清单里的条目不受规则影响
    { source: "OpenAI", title: "Untouched", url: "https://openai.com/x", date: "2026-09-24" },
  ];
  const { concepts, pruned, retouched } = reconcileExisting(existing, sources);
  assert.equal(pruned, 1);
  assert.equal(retouched, 2);
  assert.equal(concepts.length, 3);
  assert.equal(concepts.find((c) => c.url.endsWith("news0725")).date, "2024-07-25");
  assert.equal(concepts.find((c) => c.source === "Manus").date, "2025-10-16");
  assert.equal(concepts.find((c) => c.source === "OpenAI").date, "2026-09-24");
  // 策展条目（人工判断）永不因规则剔除
  const pinnedOnly = reconcileExisting(
    [{ source: "DeepSeek", title: "Your First API Call", url: "https://x/news1226", pinned: true }],
    sources,
  );
  assert.equal(pinnedOnly.pruned, 0);
  assert.equal(pinnedOnly.concepts.length, 1);
});

test("selectCapped reserves a per-source floor so low-frequency sources survive", () => {
  const sources = [
    { name: "arXiv AI", limit: 2 },
    { name: "Manus", limit: 2 },
  ];
  const merged = [
    // 高频来源：10 条全是新日期
    ...[...Array(10)].map((_, i) => ({
      source: "arXiv AI",
      url: `https://arxiv.org/abs/${i}`,
      date: `2026-09-${String(10 + i).padStart(2, "0")}`,
    })),
    // 低频来源：2 条很旧但必须保底留下
    { source: "Manus", url: "https://manus.im/blog/a", date: "2025-10-16" },
    { source: "Manus", url: "https://manus.im/blog/b", date: "2025-11-04" },
    // 策展条目：无论多旧都不淘汰
    { source: "Kimi", url: "https://www.kimi.com/news/kimi-k3", date: "2026-07-17", pinned: true },
  ];
  const capped = selectCapped(merged, sources, 6);
  assert.equal(capped.length, 6);
  assert.equal(capped.filter((c) => c.source === "Manus").length, 2);
  assert.equal(capped.filter((c) => c.pinned).length, 1);
  // 保底名额之外的剩余名额按日期倒序给最新的
  const arxiv = capped.filter((c) => c.source === "arXiv AI");
  assert.equal(arxiv.length, 3);
  assert.deepEqual(
    arxiv.map((c) => c.date),
    ["2026-09-19", "2026-09-18", "2026-09-17"],
  );
});

test("mergeItems normalizes URLs, dedups, and unions tags without resetting addedAt", () => {
  const existing = [
    {
      id: "a1",
      title: "Old title",
      source: "OpenAI",
      url: "https://example.com/a",
      date: "2026-08-01",
      summary: "",
      maturity: "emerging",
      tags: ["Agent"],
      addedAt: "2026-08-01T00:00:00.000Z",
    },
  ];
  const fetched = [
    {
      id: "a2",
      title: "Old title",
      source: "OpenAI",
      url: "https://example.com/a?utm_source=rss",
      date: "2026-08-02",
      summary: "New summary",
      maturity: "emerging",
      tags: ["Agent", "Loop"],
      addedAt: "2026-08-02T00:00:00.000Z",
    },
    {
      id: "b1",
      title: "New paper",
      source: "arXiv AI",
      url: "https://arxiv.org/abs/2501.99999",
      date: "2026-08-03",
      summary: "S",
      maturity: "proposed",
      tags: ["论文"],
      addedAt: "2026-08-03T00:00:00.000Z",
    },
  ];

  const merged = mergeItems(existing, fetched);
  assert.equal(merged.length, 2);
  const a = merged.find((c) => c.url === "https://example.com/a");
  assert.ok(a);
  assert.deepEqual([...a.tags].sort(), ["Agent", "Loop"]);
  assert.equal(a.addedAt, "2026-08-01T00:00:00.000Z");
  assert.equal(a.summary, "New summary");
  assert.equal(a.date, "2026-08-02");
});
