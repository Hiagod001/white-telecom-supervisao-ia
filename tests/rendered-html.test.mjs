import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("White Telecom product source includes the requested surfaces", async () => {
  const [page, layout, hosting] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /White Telecom Supervisao IA/);
  assert.match(page, /White Telecom Supervisao IA/);
  assert.doesNotMatch(page, /Delipe|Cota mensal|500 analises/i);
  assert.match(page, /OperatorPanel/);
  assert.match(page, /Cadastrar novo processo/);
  assert.match(page, /PBX SSH/);
  assert.match(page, /\/api\/admin\/users/);
  assert.match(hosting, /"d1": "DB"/);
});

test("build emits API routes and D1 migration", async () => {
  const serverFiles = await readdir(new URL("../dist/server", import.meta.url));
  const migrations = await readdir(new URL("../drizzle", import.meta.url));

  assert.ok(serverFiles.includes("index.js"));
  assert.ok(migrations.some((file) => file.endsWith(".sql")));
});
