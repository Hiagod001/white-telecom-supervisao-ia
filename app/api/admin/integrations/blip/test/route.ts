import { getBlipConfig, hasOpenAiKey, listBlipAttendants } from "../../../../../../lib/blip";
import { requireAuth } from "../../../../../../lib/auth";

export async function POST(request: Request) {
  const auth = await requireAuth(request, ["Administrador"]);
  if (auth.response) return auth.response;
  try {
    const config = getBlipConfig();
    const attendants = await listBlipAttendants();
    return Response.json({
      connected: true,
      contractId: config.contractId,
      botIdConfigured: Boolean(config.botId),
      attendants: attendants.total,
      openAiReady: hasOpenAiKey(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao testar a Blip.";
    return Response.json({ connected: false, error: message }, { status: 503 });
  }
}
