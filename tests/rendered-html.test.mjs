import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
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

test("server-renders Delipe Supervisao IA shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Delipe Supervisao IA<\/title>/i);
  assert.match(html, /Plataforma SaaS para supervisao/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("product source includes critical vertical slices", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /generateConversations/);
  assert.match(page, /1000/);
  assert.match(page, /ConversationDetail/);
  assert.match(page, /AiAgent/);
  assert.match(page, /Processes/);
  assert.match(page, /Integrations/);
  assert.match(page, /Apenas elegiveis/);
  assert.match(page, /Lead sem cobertura nao penaliza conversao/);
});
