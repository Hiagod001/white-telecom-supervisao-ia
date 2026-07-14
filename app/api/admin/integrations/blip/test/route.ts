import { getBlipConfig, hasOpenAiKey, listBlipAttendants } from "../../../../../../lib/blip";

export async function POST() {
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
