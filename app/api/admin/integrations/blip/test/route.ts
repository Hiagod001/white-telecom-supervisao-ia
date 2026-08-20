import { getBlipSources, hasOpenAiKey, listSupervisionAttendants } from "../../../../../../lib/blip";
import { requireAuth } from "../../../../../../lib/auth";

export async function POST(request: Request) {
  const auth = await requireAuth(request, ["Administrador"]);
  if (auth.response) return auth.response;
  try {
    const configs = getBlipSources();
    const sources = await listSupervisionAttendants();
    return Response.json({
      connected: true,
      contractId: configs[0].contractId,
      botIdConfigured: configs.every((config) => Boolean(config.botId)),
      attendants: sources.reduce((total, source) => total + source.attendants.length, 0),
      sources: sources.map((source) => ({ label: source.sourceLabel, attendants: source.attendants.length })),
      openAiReady: hasOpenAiKey(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao testar a Blip.";
    return Response.json({ connected: false, error: message }, { status: 503 });
  }
}
