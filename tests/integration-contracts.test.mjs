import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Blip connector keeps credentials server-side and exposes ingestion routes", async () => {
  const [client, webhook, sync, integrations, envExample] = await Promise.all([
    readFile(new URL("../lib/blip.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/integrations/blip/webhook/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/integrations/blip/sync/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/integrations/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
  ]);

  assert.match(client, /BLIP_CONTRACT_ID/);
  assert.match(client, /Authorization: `Key \$\{config\.authKey\}`/);
  assert.match(client, /\/attendants/);
  assert.match(client, /\/tickets/);
  assert.match(client, /threads-merged/);
  assert.match(client, /envelope\.storageDate/);
  assert.match(client, /envelopeType\.includes\("media-link"\)/);
  assert.match(webhook, /x-uai-blip-secret/);
  assert.match(sync, /analysisQueued/);
  assert.match(integrations, /safeConfigJson/);
  assert.match(integrations, /CONFIGURAR_NO_AMBIENTE/);
  assert.match(envExample, /BLIP_AUTH_KEY=/);
  assert.doesNotMatch(envExample, /sk-[a-z0-9]/i);
});

test("analysis pipeline loads processes, documents, transcript and audio before OpenAI", async () => {
  const [analysisRoute, openai, transcription, migration] = await Promise.all([
    readFile(new URL("../app/api/admin/analysis/run/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/openai-analysis.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/openai-transcription.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0001_outgoing_thanos.sql", import.meta.url), "utf8"),
  ]);

  assert.match(analysisRoute, /processDefinitions/);
  assert.match(analysisRoute, /processDocuments/);
  assert.match(analysisRoute, /blipMessages/);
  assert.match(openai, /https:\/\/api\.openai\.com\/v1\/responses/);
  assert.match(openai, /json_schema/);
  assert.match(analysisRoute, /transcribeBlipAudio/);
  assert.match(analysisRoute, /hasOpenAiKey/);
  assert.match(analysisRoute, /\["Pendente", "Erro"\]/);
  assert.match(transcription, /https:\/\/api\.openai\.com\/v1\/audio\/transcriptions/);
  assert.match(transcription, /gpt-4o-mini-transcribe/);
  assert.match(migration, /CREATE TABLE `blip_messages`/);
  assert.match(migration, /CREATE TABLE `process_documents`/);
  assert.match(migration, /CREATE TABLE `conversation_analyses`/);
});

test("administrator can list and create attendants without storing Blip secrets in the browser", async () => {
  const attendantsRoute = await readFile(new URL("../app/api/admin/attendants/route.ts", import.meta.url), "utf8");

  assert.match(attendantsRoute, /export async function GET/);
  assert.match(attendantsRoute, /export async function POST/);
  assert.match(attendantsRoute, /blipAttendants/);
  assert.match(attendantsRoute, /source: row\.identity\.startsWith\("manual:"\)/);
  assert.match(attendantsRoute, /crypto\.randomUUID/);
  assert.doesNotMatch(attendantsRoute, /BLIP_AUTH_KEY/);
});

test("task workflow persists alert-linked work and status changes", async () => {
  const [taskRoute, schema, migration, page] = await Promise.all([
    readFile(new URL("../app/api/tasks/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0002_melted_wallow.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(taskRoute, /export async function GET/);
  assert.match(taskRoute, /export async function POST/);
  assert.match(taskRoute, /export async function PATCH/);
  assert.match(taskRoute, /Informe como a tarefa foi resolvida/);
  assert.match(schema, /export const tasks = sqliteTable\("tasks"/);
  assert.match(migration, /CREATE TABLE `tasks`/);
  assert.match(page, /function TasksWorkspace/);
  assert.match(page, /onCreateTask={createTaskFromAlert}/);
  assert.match(page, /Acompanhe responsáveis, prazos e andamento/);
});
