import { env } from "cloudflare:workers";
import { asc, eq, inArray, ne } from "drizzle-orm";
import { getDb } from "../../../../../db";
import {
  blipMessages,
  blipTickets,
  conversationAnalyses,
  processDefinitions,
  processDocuments,
} from "../../../../../db/schema";
import { inferSector } from "../../../../../lib/blip-storage";
import { hasOpenAiKey } from "../../../../../lib/blip";
import { analyzeAttendance } from "../../../../../lib/openai-analysis";
import { transcribeBlipAudio } from "../../../../../lib/openai-transcription";
import { requireAuth } from "../../../../../lib/auth";

type FileEnv = { PROCESS_FILES?: R2Bucket };

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const cause = error && typeof error === "object" && "cause" in error
    ? (error as { cause?: { message?: string } }).cause?.message ?? ""
    : "";
  if (`${message} ${cause}`.includes("no such table")) return "Banco D1 ainda nao esta migrado para analises.";
  return message;
}

function processContext(
  processes: Array<typeof processDefinitions.$inferSelect>,
  documents: Array<typeof processDocuments.$inferSelect>,
) {
  return processes.map((process) => {
    const steps = JSON.parse(process.stepsJson) as Array<{ name: string; weight: number; criterion: string }>;
    const channels = JSON.parse(process.channelsJson) as string[];
    const docs = documents.filter((document) => document.processId === process.id);
    return [
      `PROCESSO #${process.id}: ${process.name}`,
      `Setor: ${process.sector}; status: ${process.status}; versao: ${process.version}`,
      `Canais aplicaveis: ${channels.length ? channels.join(", ") : "todos"}`,
      `Objetivo: ${process.objective}`,
      process.instructions ? `Instrucoes: ${process.instructions}` : "",
      `Etapas:\n${steps.map((step) => `- ${step.name} (peso ${step.weight}): ${step.criterion}`).join("\n")}`,
      docs.length
        ? `Documentos:\n${docs.map((document) => `- ${document.name} [${document.status}]\n${document.extractedText.slice(0, 12_000)}`).join("\n")}`
        : "Documentos: nenhum",
    ].filter(Boolean).join("\n");
  }).join("\n\n---\n\n");
}

function toBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, Math.min(index + 0x8000, bytes.length)));
  }
  return btoa(binary);
}

async function binaryDocuments(documents: Array<typeof processDocuments.$inferSelect>, processIds: number[]) {
  const bucket = (env as unknown as FileEnv).PROCESS_FILES;
  if (!bucket) return [];
  const selected = documents
    .filter((document) => processIds.includes(document.processId) && document.storageKey && !document.extractedText)
    .slice(0, 5);
  const files: Array<{ filename: string; mimeType: string; base64: string }> = [];
  let totalSize = 0;

  for (const document of selected) {
    if (!document.storageKey || totalSize + document.size > 15 * 1024 * 1024) continue;
    const object = await bucket.get(document.storageKey);
    if (!object) continue;
    const data = await object.arrayBuffer();
    totalSize += data.byteLength;
    files.push({ filename: document.name, mimeType: document.mimeType, base64: toBase64(data) });
  }
  return files;
}

async function enrichAudioMessages(
  db: ReturnType<typeof getDb>,
  messages: Array<typeof blipMessages.$inferSelect>,
) {
  return Promise.all(messages.map(async (message) => {
    const isAudio = message.contentType.toLowerCase().includes("audio");
    const alreadyTranscribed = message.contentText.startsWith("[Audio transcrito]");
    if (!isAudio || !message.mediaUri || alreadyTranscribed) return message;

    try {
      const transcription = await transcribeBlipAudio(message.mediaUri, message.contentType);
      const contentText = `[Audio transcrito] ${transcription.text}`;
      await db
        .update(blipMessages)
        .set({ contentText })
        .where(eq(blipMessages.id, message.id));
      return { ...message, contentText };
    } catch {
      return message;
    }
  }));
}

export async function POST(request: Request) {
  const auth = await requireAuth(request, ["Administrador"]);
  if (auth.response) return auth.response;
  try {
    if (!hasOpenAiKey()) {
      return Response.json(
        { error: "OPENAI_API_KEY ainda nao foi configurada no ambiente seguro." },
        { status: 503 },
      );
    }
    const payload = (await request.json().catch(() => ({}))) as { ticketId?: string; limit?: number };
    const db = getDb();
    const limit = Math.min(10, Math.max(1, Number(payload.limit ?? 3)));
    const queue = await db
      .select()
      .from(conversationAnalyses)
      .where(payload.ticketId
        ? eq(conversationAnalyses.ticketId, payload.ticketId)
        : inArray(conversationAnalyses.status, ["Pendente", "Erro"]))
      .orderBy(asc(conversationAnalyses.id))
      .limit(limit);

    if (!queue.length) return Response.json({ analyzed: 0, message: "Nenhuma analise pendente." });

    const [processes, documents] = await Promise.all([
      db.select().from(processDefinitions).where(ne(processDefinitions.status, "Arquivado")),
      db.select().from(processDocuments),
    ]);
    if (!processes.length) {
      return Response.json({ error: "Cadastre ao menos um processo antes de analisar atendimentos." }, { status: 409 });
    }
    const attachedFiles = await binaryDocuments(documents, processes.map((process) => process.id));

    let analyzed = 0;
    const failures: Array<{ ticketId: string; error: string }> = [];

    for (const job of queue) {
      const [ticket] = await db
        .select()
        .from(blipTickets)
        .where(eq(blipTickets.externalId, job.ticketId))
        .limit(1);
      if (!ticket) {
        failures.push({ ticketId: job.ticketId, error: "Ticket nao encontrado." });
        continue;
      }

      const storedMessages = await db
        .select()
        .from(blipMessages)
        .where(eq(blipMessages.ticketId, job.ticketId))
        .orderBy(asc(blipMessages.storageDate));
      if (!storedMessages.length) {
        failures.push({ ticketId: job.ticketId, error: "Transcricao ainda nao foi importada." });
        continue;
      }

      await db
        .update(conversationAnalyses)
        .set({ status: "Processando", error: "", updatedAt: new Date().toISOString() })
        .where(eq(conversationAnalyses.id, job.id));

      try {
        const messages = await enrichAudioMessages(db, storedMessages);
        const result = await analyzeAttendance({
          ticketId: job.ticketId,
          sector: inferSector(ticket.team),
          processContext: processContext(processes, documents),
          documents: attachedFiles,
          transcript: messages
            .map((message) => `[${message.storageDate}] ${message.role.toUpperCase()} ${message.senderName || message.senderIdentity}: ${message.contentText}`)
            .join("\n"),
        });
        await db
          .update(conversationAnalyses)
          .set({
            status: "Concluida",
            model: result.model,
            processIdsJson: JSON.stringify(processes.map((process) => process.id)),
            resultJson: JSON.stringify(result.result),
            analyzedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(conversationAnalyses.id, job.id));
        analyzed += 1;
      } catch (error) {
        const message = routeError(error);
        await db
          .update(conversationAnalyses)
          .set({ status: "Erro", error: message, updatedAt: new Date().toISOString() })
          .where(eq(conversationAnalyses.id, job.id));
        failures.push({ ticketId: job.ticketId, error: message });
      }
    }

    return Response.json({ analyzed, failures });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}
