import { desc } from "drizzle-orm";
import { getDb } from "../../../../db";
import { integrations } from "../../../../db/schema";
import { requireAuth } from "../../../../lib/auth";
import { getBlipSources, hasOpenAiKey, isBlipTicketImportEnabled } from "../../../../lib/blip";
import { runtimeEnv } from "../../../../lib/runtime-env";

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const cause = error && typeof error === "object" && "cause" in error
    ? (error as { cause?: { message?: string } }).cause?.message ?? ""
    : "";
  if (`${message} ${cause}`.includes("no such table")) {
    return "Banco D1 ainda nao esta migrado. Gere e publique as migracoes antes de salvar integracoes.";
  }
  return message;
}

function safeConfig(config: Record<string, string>) {
  const blocked = /token|secret|password|api.?key|auth.?key/i;
  return Object.fromEntries(
    Object.entries(config).map(([key, value]) => [
      key,
      blocked.test(key) && !key.toLowerCase().endsWith("ref") ? "CONFIGURAR_NO_AMBIENTE" : value,
    ]),
  );
}

function safeConfigJson(configJson: string) {
  try {
    return JSON.stringify(safeConfig(JSON.parse(configJson) as Record<string, string>));
  } catch {
    return "{}";
  }
}

export async function GET(request: Request) {
  const auth = await requireAuth(request, ["Administrador"]);
  if (auth.response) return auth.response;
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(integrations)
      .orderBy(desc(integrations.id))
      .limit(50);

    const values = runtimeEnv();
    let blipSources: ReturnType<typeof getBlipSources> = [];
    try {
      blipSources = getBlipSources();
    } catch {
      blipSources = [];
    }
    const blip = blipSources[0];
    const openAiReady = hasOpenAiKey();
    const pbxReady = Boolean(values.PBX_HOST?.trim() && values.PBX_USER?.trim());

    return Response.json({
      integrations: rows.map((row) => ({ ...row, configJson: safeConfigJson(row.configJson) })),
      configs: [
        {
          provider: "Blip",
          status: blip ? "Configurado" : "Nao configurado",
          fields: {
            source: blip?.label ?? "Aguardando configuracao",
            contractId: blip?.contractId ?? "Nao configurado",
            botId: blip?.botId ?? "Nao configurado",
            credentialStatus: blip ? "Chave segura configurada no servidor" : "Chave ausente",
            ticketImport: isBlipTicketImportEnabled() ? "Ativa" : "Controlada manualmente",
          },
        },
        {
          provider: "OpenAI",
          status: openAiReady ? "Configurado" : "Nao configurado",
          fields: {
            model: values.OPENAI_MODEL?.trim() || "gpt-5.6-luna",
            transcriptionModel: values.OPENAI_TRANSCRIPTION_MODEL?.trim() || "gpt-4o-mini-transcribe",
            apiKeyStatus: openAiReady ? "Chave segura configurada no servidor" : "Chave ausente",
          },
        },
        {
          provider: "PBX SSH",
          status: pbxReady ? "Configurado" : "Nao configurado",
          fields: {
            host: values.PBX_HOST?.trim() || "Aguardando dados do PBX",
            port: values.PBX_PORT?.trim() || "22",
            username: values.PBX_USER?.trim() || "Aguardando dados do PBX",
            recordingsPath: values.PBX_RECORDINGS_PATH?.trim() || "Aguardando dados do PBX",
          },
        },
      ],
    });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth(request, ["Administrador"]);
  if (auth.response) return auth.response;
  try {
    const payload = (await request.json()) as {
      provider?: string;
      status?: string;
      config?: Record<string, string>;
    };
    const provider = payload.provider?.trim() ?? "";

    if (!provider) {
      return Response.json({ error: "Provider e obrigatorio." }, { status: 400 });
    }

    const db = getDb();
    const [created] = await db
      .insert(integrations)
      .values({
        provider,
        status: payload.status ?? "Configurado",
        configJson: JSON.stringify(safeConfig(payload.config ?? {})),
      })
      .returning();

    return Response.json({ integration: created }, { status: 201 });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}
