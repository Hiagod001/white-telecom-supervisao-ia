import { env } from "cloudflare:workers";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { processDefinitions, processDocuments } from "../../../../../db/schema";
import { requireAuth } from "../../../../../lib/auth";

type FileEnv = { PROCESS_FILES?: R2Bucket };

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const cause = error && typeof error === "object" && "cause" in error
    ? (error as { cause?: { message?: string } }).cause?.message ?? ""
    : "";
  if (`${message} ${cause}`.includes("no such table")) {
    return "Banco D1 ainda nao esta migrado para documentos de processo.";
  }
  return message;
}

function isTextDocument(file: File) {
  return (
    file.type.startsWith("text/") ||
    ["application/json", "application/xml", "text/csv"].includes(file.type) ||
    /\.(txt|md|csv|json|xml)$/i.test(file.name)
  );
}

function safeName(name: string) {
  return name.replace(/[^a-z0-9._-]+/gi, "-").replace(/-+/g, "-");
}

export async function GET(request: Request) {
  const auth = await requireAuth(request, ["Administrador", "Gestor"]);
  if (auth.response) return auth.response;
  try {
    const url = new URL(request.url);
    const documentId = Number(url.searchParams.get("id"));
    const processId = Number(url.searchParams.get("processId"));
    const db = getDb();

    if (documentId) {
      const [document] = await db
        .select()
        .from(processDocuments)
        .where(eq(processDocuments.id, documentId))
        .limit(1);
      if (!document) return Response.json({ error: "Documento nao encontrado." }, { status: 404 });

      const bucket = (env as unknown as FileEnv).PROCESS_FILES;
      if (bucket && document.storageKey) {
        const object = await bucket.get(document.storageKey);
        if (!object) return Response.json({ error: "Arquivo nao encontrado no armazenamento." }, { status: 404 });
        return new Response(object.body, {
          headers: {
            "Content-Type": document.mimeType || object.httpMetadata?.contentType || "application/octet-stream",
            "Content-Disposition": `inline; filename="${safeName(document.name)}"`,
            "Cache-Control": "private, no-store",
          },
        });
      }
      if (document.extractedText) {
        return new Response(document.extractedText, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Content-Disposition": `inline; filename="${safeName(document.name)}"`,
            "Cache-Control": "private, no-store",
          },
        });
      }
      return Response.json({ error: "Este arquivo ainda nao esta disponivel para visualizacao." }, { status: 404 });
    }

    if (!processId) {
      return Response.json({ error: "processId e obrigatorio." }, { status: 400 });
    }
    const documents = await db
      .select()
      .from(processDocuments)
      .where(eq(processDocuments.processId, processId))
      .orderBy(desc(processDocuments.id));
    return Response.json({ documents });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth(request, ["Administrador"]);
  if (auth.response) return auth.response;
  try {
    const form = await request.formData();
    const processId = Number(form.get("processId"));
    const file = form.get("file");
    if (!processId || !(file instanceof File)) {
      return Response.json({ error: "Processo e arquivo sao obrigatorios." }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return Response.json({ error: "O documento deve ter no maximo 10 MB." }, { status: 400 });
    }

    const db = getDb();
    const [process] = await db
      .select({ id: processDefinitions.id })
      .from(processDefinitions)
      .where(eq(processDefinitions.id, processId))
      .limit(1);
    if (!process) {
      return Response.json({ error: "Processo nao encontrado." }, { status: 404 });
    }

    const textDocument = isTextDocument(file);
    const extractedText = textDocument ? (await file.text()).slice(0, 300_000) : "";
    const bucket = (env as unknown as FileEnv).PROCESS_FILES;
    let storageKey: string | null = null;
    let status = textDocument ? "Texto extraido" : "Aguardando R2";

    if (bucket) {
      storageKey = `processes/${processId}/${crypto.randomUUID()}-${safeName(file.name)}`;
      await bucket.put(storageKey, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type || "application/octet-stream" },
        customMetadata: { processId: String(processId), originalName: file.name },
      });
      status = textDocument ? "Texto extraido" : "Arquivo armazenado";
    } else if (!textDocument) {
      return Response.json(
        { error: "Configure o binding R2 PROCESS_FILES para armazenar PDF, DOCX e outros arquivos binarios." },
        { status: 503 },
      );
    }

    const [created] = await db
      .insert(processDocuments)
      .values({
        processId,
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        storageKey,
        extractedText,
        status,
      })
      .returning();
    return Response.json({ document: created }, { status: 201 });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAuth(request, ["Administrador"]);
  if (auth.response) return auth.response;
  try {
    const url = new URL(request.url);
    const id = Number(url.searchParams.get("id"));
    const processId = Number(url.searchParams.get("processId"));
    if (!id || !processId) {
      return Response.json({ error: "id e processId sao obrigatorios." }, { status: 400 });
    }

    const db = getDb();
    const [document] = await db
      .select()
      .from(processDocuments)
      .where(and(eq(processDocuments.id, id), eq(processDocuments.processId, processId)))
      .limit(1);
    if (!document) return Response.json({ error: "Documento nao encontrado." }, { status: 404 });

    const bucket = (env as unknown as FileEnv).PROCESS_FILES;
    if (bucket && document.storageKey) await bucket.delete(document.storageKey);
    await db
      .delete(processDocuments)
      .where(and(eq(processDocuments.id, id), eq(processDocuments.processId, processId)));
    return Response.json({ deleted: true });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}
