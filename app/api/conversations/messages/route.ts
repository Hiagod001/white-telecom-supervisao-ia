import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { blipMessages } from "../../../../db/schema";

export async function GET(request: Request) {
  try {
    const ticketId = new URL(request.url).searchParams.get("ticketId")?.trim() ?? "";
    if (!ticketId) return Response.json({ error: "ticketId e obrigatorio." }, { status: 400 });

    const db = getDb();
    const messages = await db
      .select({
        id: blipMessages.externalId,
        role: blipMessages.role,
        senderName: blipMessages.senderName,
        contentType: blipMessages.contentType,
        text: blipMessages.contentText,
        mediaUri: blipMessages.mediaUri,
        timestamp: blipMessages.storageDate,
        status: blipMessages.status,
      })
      .from(blipMessages)
      .where(eq(blipMessages.ticketId, ticketId))
      .orderBy(asc(blipMessages.storageDate));
    return Response.json({ messages });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao carregar a transcricao.";
    const cause = error && typeof error === "object" && "cause" in error
      ? (error as { cause?: { message?: string } }).cause?.message ?? ""
      : "";
    if (`${message} ${cause}`.includes("no such table")) return Response.json({ messages: [] });
    return Response.json({ error: message }, { status: 500 });
  }
}
