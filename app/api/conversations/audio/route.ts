import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { blipMessages, blipTickets } from "../../../../db/schema";
import { requireAuth } from "../../../../lib/auth";
import { refreshBlipMediaUrl } from "../../../../lib/blip";

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (auth.response || !auth.user) return auth.response;
  try {
    const messageId = new URL(request.url).searchParams.get("messageId")?.trim() ?? "";
    if (!messageId) return Response.json({ error: "messageId e obrigatorio." }, { status: 400 });
    const db = getDb();
    const [message] = await db.select().from(blipMessages).where(eq(blipMessages.externalId, messageId)).limit(1);
    if (!message || !message.contentType.toLowerCase().includes("audio")) {
      return Response.json({ error: "Audio nao encontrado." }, { status: 404 });
    }

    const [ticket] = await db.select().from(blipTickets).where(eq(blipTickets.externalId, message.ticketId)).limit(1);
    if (auth.user.role === "Operador") {
      const identityMatch = Boolean(auth.user.attendantIdentity) && ticket?.attendantIdentity === auth.user.attendantIdentity;
      const nameMatch = ticket?.attendantName.trim().toLowerCase() === auth.user.name.trim().toLowerCase();
      if (!ticket || !identityMatch && !nameMatch) {
        return Response.json({ error: "Audio nao permitido para este usuario." }, { status: 403 });
      }
    }

    const mediaUri = await refreshBlipMediaUrl(message.ticketId, message.externalId);
    await db.update(blipMessages).set({ mediaUri }).where(eq(blipMessages.id, message.id));
    const range = request.headers.get("range");
    const mediaResponse = await fetch(mediaUri, { headers: range ? { Range: range } : undefined });
    if (!mediaResponse.ok) {
      return Response.json({ error: `A Blip respondeu HTTP ${mediaResponse.status} ao carregar o audio.` }, { status: 502 });
    }

    const headers = new Headers({
      "Content-Type": mediaResponse.headers.get("content-type") || message.contentType,
      "Cache-Control": "private, max-age=300",
      "Accept-Ranges": "bytes",
    });
    for (const name of ["content-length", "content-range"]) {
      const value = mediaResponse.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new Response(mediaResponse.body, { status: mediaResponse.status, headers });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : "Falha ao carregar o audio.",
    }, { status: 500 });
  }
}
