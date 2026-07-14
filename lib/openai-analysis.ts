import { env } from "cloudflare:workers";

type RuntimeEnv = Record<string, string | undefined>;

export type AnalysisInput = {
  ticketId: string;
  sector: string;
  transcript: string;
  processContext: string;
  documents?: Array<{
    filename: string;
    mimeType: string;
    base64: string;
  }>;
};

export type AttendanceAnalysis = {
  overallScore: number;
  adherence: number;
  classification: string;
  resolution: string;
  summary: string;
  strengths: string[];
  improvements: string[];
  risks: string[];
  processMatch: string;
  stepEvaluations: Array<{
    step: string;
    status: string;
    score: number;
    evidence: string;
  }>;
};

function runtimeEnv() {
  return env as unknown as RuntimeEnv;
}

function outputText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === "string") return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as { content?: unknown[] }).content)
      ? (item as { content: unknown[] }).content
      : [];
    for (const part of content) {
      if (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string") {
        return (part as { text: string }).text;
      }
    }
  }
  return "";
}

export async function analyzeAttendance(input: AnalysisInput) {
  const values = runtimeEnv();
  const apiKey = values.OPENAI_API_KEY?.trim() ?? "";
  const model = values.OPENAI_MODEL?.trim() || "gpt-5.6-luna";

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY ainda nao foi configurada.");
  }

  const content: Array<Record<string, unknown>> = [
    ...(input.documents ?? []).map((document) => ({
      type: "input_file",
      filename: document.filename,
      file_data: `data:${document.mimeType};base64,${document.base64}`,
      ...(document.mimeType === "application/pdf" ? { detail: "low" } : {}),
    })),
    {
      type: "input_text",
      text: `ATENDIMENTO ${input.ticketId}\nSETOR SUGERIDO: ${input.sector}\n\nPROCESSOS E DOCUMENTOS:\n${input.processContext}\n\nTRANSCRICAO:\n${input.transcript}`,
    },
  ];

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions: [
        "Voce e o motor de supervisao da Uai Telecom.",
        "Analise somente evidencias presentes na transcricao e nos processos fornecidos.",
        "Escolha o processo aplicavel antes de pontuar. Nao invente fatos ausentes.",
        "Quando uma etapa nao puder ser comprovada, marque como Incerto e explique a ausencia de evidencia.",
        "Use linguagem simples, operacional e em portugues do Brasil.",
      ].join(" "),
      input: [
        {
          role: "user",
          content,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "attendance_analysis",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: [
              "overallScore",
              "adherence",
              "classification",
              "resolution",
              "summary",
              "strengths",
              "improvements",
              "risks",
              "processMatch",
              "stepEvaluations",
            ],
            properties: {
              overallScore: { type: "number", minimum: 0, maximum: 10 },
              adherence: { type: "number", minimum: 0, maximum: 100 },
              classification: { type: "string" },
              resolution: { type: "string" },
              summary: { type: "string" },
              strengths: { type: "array", items: { type: "string" } },
              improvements: { type: "array", items: { type: "string" } },
              risks: { type: "array", items: { type: "string" } },
              processMatch: { type: "string" },
              stepEvaluations: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["step", "status", "score", "evidence"],
                  properties: {
                    step: { type: "string" },
                    status: {
                      type: "string",
                      enum: ["Cumpriu", "Nao cumpriu", "Nao aplicavel", "Incerto"],
                    },
                    score: { type: "number", minimum: 0, maximum: 10 },
                    evidence: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    }),
  });

  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const error = payload.error as { message?: string } | undefined;
    throw new Error(error?.message ?? `OpenAI respondeu HTTP ${response.status}.`);
  }

  const text = outputText(payload);
  if (!text) throw new Error("A OpenAI nao retornou uma analise estruturada.");

  return {
    model,
    result: JSON.parse(text) as AttendanceAnalysis,
  };
}
