import { env } from "cloudflare:workers";

type RuntimeEnv = Record<string, string | undefined>;

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

function runtimeEnv() {
  return env as unknown as RuntimeEnv;
}

function audioFilename(contentType: string) {
  const extensions: Record<string, string> = {
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/wav": "wav",
    "audio/webm": "webm",
    "audio/ogg": "ogg",
  };
  return `atendimento.${extensions[contentType] ?? "mp3"}`;
}

export async function transcribeBlipAudio(mediaUri: string, contentType = "audio/mpeg") {
  const values = runtimeEnv();
  const apiKey = values.OPENAI_API_KEY?.trim() ?? "";
  const model = values.OPENAI_TRANSCRIPTION_MODEL?.trim() || "gpt-4o-mini-transcribe";

  if (!apiKey) throw new Error("OPENAI_API_KEY ainda nao foi configurada.");

  const mediaResponse = await fetch(mediaUri);
  if (!mediaResponse.ok) {
    throw new Error(`Nao foi possivel baixar o audio da Blip (HTTP ${mediaResponse.status}).`);
  }

  const contentLength = Number(mediaResponse.headers.get("content-length") ?? 0);
  if (contentLength > MAX_AUDIO_BYTES) {
    throw new Error("O audio da Blip ultrapassa o limite de 25 MB para transcricao.");
  }

  const audio = await mediaResponse.arrayBuffer();
  if (audio.byteLength > MAX_AUDIO_BYTES) {
    throw new Error("O audio da Blip ultrapassa o limite de 25 MB para transcricao.");
  }

  const detectedType = mediaResponse.headers.get("content-type")?.split(";")[0] || contentType;
  const form = new FormData();
  form.append("file", new Blob([audio], { type: detectedType }), audioFilename(detectedType));
  form.append("model", model);
  form.append("language", "pt");
  form.append("response_format", "json");
  form.append("prompt", "Atendimento da Uai Telecom em portugues do Brasil, com termos de internet, fibra, roteador, plano, protocolo e suporte tecnico.");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const payload = (await response.json()) as { text?: string; error?: { message?: string } };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `OpenAI respondeu HTTP ${response.status} ao transcrever.`);
  }

  const text = payload.text?.trim() ?? "";
  if (!text) throw new Error("A OpenAI nao retornou texto para o audio.");
  return { model, text };
}
