import assert from "node:assert/strict";
import test from "node:test";

import {
  decodeEntities,
  mergeItems,
  normalizeUrl,
  parseArxiv,
  parseFeed,
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
});
