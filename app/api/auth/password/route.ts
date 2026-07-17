import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { authSessions, users } from "../../../../db/schema";
import {
  createSession,
  hashPassword,
  passwordIsStrong,
  requireAuth,
  sessionCookie,
  verifyPassword,
} from "../../../../lib/auth";

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (auth.response || !auth.user) return auth.response;
  try {
    const payload = (await request.json()) as { currentPassword?: string; newPassword?: string };
    const currentPassword = payload.currentPassword ?? "";
    const newPassword = payload.newPassword ?? "";
    if (!passwordIsStrong(newPassword)) {
      return Response.json({ error: "A nova senha deve ter 12 caracteres, maiuscula, minuscula, numero e simbolo." }, { status: 400 });
    }
    if (currentPassword === newPassword) {
      return Response.json({ error: "A nova senha deve ser diferente da atual." }, { status: 400 });
    }
    const db = getDb();
    const [stored] = await db.select().from(users).where(eq(users.id, auth.user.id)).limit(1);
    if (!stored || !await verifyPassword(currentPassword, stored.passwordHash)) {
      return Response.json({ error: "Senha atual incorreta." }, { status: 401 });
    }
    const now = new Date().toISOString();
    await db.update(users).set({
      passwordHash: await hashPassword(newPassword),
      mustChangePassword: false,
      passwordChangedAt: now,
      updatedAt: now,
    }).where(eq(users.id, auth.user.id));
    await db.delete(authSessions).where(eq(authSessions.userId, auth.user.id));
    const session = await createSession(request, auth.user.id);
    return Response.json(
      { changed: true },
      { headers: { "Set-Cookie": sessionCookie(session.token, request), "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Falha ao alterar senha." }, { status: 500 });
  }
}
