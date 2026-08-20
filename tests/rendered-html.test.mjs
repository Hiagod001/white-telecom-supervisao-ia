import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("Uai Telecom product source includes the requested surfaces", async () => {
  const [page, layout, hosting] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /Uai Telecom - Supervisão IA/);
  assert.match(page, /Uai Telecom/);
  assert.doesNotMatch(page, /Delipe|Cota mensal|500 analises/i);
  assert.match(page, /OperatorPanel/);
  assert.match(page, /operatorNavItems/);
  assert.match(page, /Processos cadastrados/);
  assert.match(page, /Criar processo/);
  assert.match(page, /Editar processo/);
  assert.match(page, /Canais aplicáveis/);
  assert.match(page, /WhatsApp/);
  assert.match(page, /Blip Chat/);
  assert.match(page, /Ligação/);
  assert.match(page, /PBX SSH/);
  assert.match(page, /\/api\/admin\/users/);
  assert.match(page, /Reincidência/);
  assert.match(page, /Por atendimento/);
  assert.match(page, /Leads e vendas por período/);
  assert.match(page, /alert-timeline/);
  assert.match(page, /Documentos de referência/);
  assert.match(page, /chat-message-row/);
  assert.match(page, /Sincronizar agora/);
  assert.match(page, /Confirmar resolução/);
  assert.match(page, /Tarefas/);
  assert.match(page, /Nova tarefa/);
  assert.match(page, /Em andamento/);
  assert.match(page, /Confirmar atribuição/);
  assert.match(page, /Ativar modo claro/);
  assert.match(page, /Cadastrar atendente/);
  assert.match(hosting, /"d1": "DB"/);
  assert.match(hosting, /"r2": "PROCESS_FILES"/);
});

test("build emits API routes and D1 migration", async () => {
  const serverFiles = await readdir(new URL("../dist/server", import.meta.url));
  const migrations = await readdir(new URL("../drizzle", import.meta.url));

  assert.ok(serverFiles.includes("index.js"));
  assert.ok(migrations.some((file) => file.endsWith(".sql")));
});
