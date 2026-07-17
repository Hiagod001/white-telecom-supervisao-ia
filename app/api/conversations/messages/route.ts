import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { blipMessages, blipTickets } from "../../../../db/schema";
import { requireAuth } from "../../../../lib/auth";

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (auth.response || !auth.user) return auth.response;
  try {
    const ticketId = new URL(request.url).searchParams.get("ticketId")?.trim() ?? "";
    if (!ticketId) return Response.json({ error: "ticketId e obrigatorio." }, { status: 400 });

    const db = getDb();
    if (auth.user.role === "Operador") {
      const [ticket] = await db.select().from(blipTickets).where(eq(blipTickets.externalId, ticketId)).limit(1);
      const identityMatch = Boolean(auth.user.attendantIdentity) && ticket?.attendantIdentity === auth.user.attendantIdentity;
      const nameMatch = ticket?.attendantName.trim().toLowerCase() === auth.user.name.trim().toLowerCase();
      if (!ticket || !identityMatch && !nameMatch) {
        return Response.json({ error: "Atendimento nao permitido para este usuario." }, { status: 403 });
      }
    }
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
