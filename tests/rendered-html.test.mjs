import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the AI Learning Lab product surface", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>AI Learning Lab/);
  assert.match(html, /前沿技术，亲手跑懂/);
  assert.match(html, /Harness Lab/);
  assert.match(html, /Loop Lab/);
  assert.match(html, /Graph Lab/);
  assert.match(html, /知识网络/);
  assert.match(html, /一手来源/);
  assert.match(html, /Skill 体系/);
  assert.match(html, /Agent Card/);
  assert.match(html, /A2A/);
  assert.match(html, /knowledge_chat/);
  assert.match(html, /一个标准 Skill 真正必需的只有/);
  assert.match(html, /判断手感/);
  assert.match(html, /start-card/);
  assert.match(html, /今日路径/);
  assert.match(html, /context-card/);
  assert.match(html, /tool-chip/);
  assert.match(html, /wing-picker/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
  assert.doesNotMatch(html, /为你/);
});

test("preserves the original learning assets as deeper courses", async () => {
  const response = await render();
  const html = await response.text();

  assert.match(html, /href="\/agent-foundations\.html"/);
  assert.match(html, /href="\/git-workflow\.html"/);
});


test("foundations HTML and React surface include ACP and CLI", async () => {
  const foundations = readFileSync(new URL("../public/agent-foundations.html", import.meta.url), "utf8");
  assert.match(foundations, /id="sec-acp"/);
  assert.match(foundations, /id="sec-cli"/);
  assert.match(foundations, /Agent Client Protocol/);
  assert.match(foundations, /agentclientprotocol\.com/);
  assert.match(foundations, /Grok CLI|Codex CLI|stdio agent/);

  const html = await (await render()).text();
  assert.match(html, /\bACP\b/);
  assert.match(html, /Agent CLI/);
  assert.match(html, /Client ↔ Agent|Client ↔ 本地 Agent/);
});
