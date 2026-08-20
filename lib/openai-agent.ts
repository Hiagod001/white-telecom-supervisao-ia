import { runtimeEnv } from "./runtime-env";

export type AgentChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AgentAnswer = {
  content: string;
  facts: string[];
  sources: string[];
  confidence: "Alta" | "Media" | "Baixa";
};

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

export async function askSupervisionAgent(input: {
  question: string;
  history: AgentChatMessage[];
  businessContext: Record<string, unknown>;
}) {
  const values = runtimeEnv();
  const apiKey = values.OPENAI_API_KEY?.trim() ?? "";
  const model = values.OPENAI_MODEL?.trim() || "gpt-5.6-luna";

  if (!apiKey) throw new Error("OPENAI_API_KEY ainda nao foi configurada.");

  const compactHistory = input.history.slice(-6).map((message) => ({
    role: message.role,
    content: message.content.slice(0, 2_000),
  }));
  const context = JSON.stringify(input.businessContext).slice(0, 60_000);

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      store: false,
      reasoning: { effort: "medium" },
      max_output_tokens: 1_200,
      instructions: [
        "Voce e o Agente de Supervisao da Uai Telecom.",
        "Sua funcao e apoiar decisoes sobre atendimento, comercial e retencao usando exclusivamente o contexto fornecido pelo sistema.",
        "Nunca invente numeros, falas, causas, processos ou conclusoes. Quando faltarem dados, diga exatamente o que falta.",
        "Respeite rigorosamente o escopo e as permissoes informados. Operadores nunca podem receber dados ou comparacoes de outros atendentes.",
        "Em Atendimento use os termos atendente ou operador; em Comercial use vendedor; em Retencao use atendente de retencao.",
        "Diferencie regra de processo, dado sincronizado e recomendacao. Nao apresente recomendacao como fato.",
        "Use portugues do Brasil, linguagem simples, resposta direta e no maximo quatro paragrafos curtos.",
        "Quando houver amostra pequena, ressalve isso. Nao tome decisoes disciplinares; apresente evidencias para o gestor decidir.",
        "Liste em facts somente numeros ou evidencias centrais. Em sources informe nomes concretos das fontes fornecidas.",
      ].join(" "),
      input: [
        ...compactHistory,
        {
          role: "user",
          content: `CONTEXTO AUTORIZADO DO SISTEMA:\n${context}\n\nPERGUNTA ATUAL:\n${input.question}`,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "supervision_agent_answer",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["content", "facts", "sources", "confidence"],
            properties: {
              content: { type: "string" },
              facts: { type: "array", maxItems: 6, items: { type: "string" } },
              sources: { type: "array", maxItems: 6, items: { type: "string" } },
              confidence: { type: "string", enum: ["Alta", "Media", "Baixa"] },
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
  if (!text) throw new Error("A OpenAI nao retornou uma resposta para o agente.");

  return {
    model,
    answer: JSON.parse(text) as AgentAnswer,
    usage: payload.usage ?? null,
  };
}
