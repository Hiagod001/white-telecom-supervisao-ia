import { and, desc, eq, gte } from "drizzle-orm";
import { getDb } from "../../../../db";
import { authLoginAttempts, users } from "../../../../db/schema";
import { clientIp, createSession, hashPassword, requireSameOrigin, sessionCookie, verifyPassword } from "../../../../lib/auth";

const MAX_ATTEMPTS = 5;

export async function POST(request: Request) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  try {
    const payload = (await request.json()) as { email?: string; password?: string };
    const email = payload.email?.trim().toLowerCase() ?? "";
    const password = payload.password ?? "";
    const ipAddress = clientIp(request);
    if (!email || !password) {
      return Response.json({ error: "Informe e-mail e senha." }, { status: 400 });
    }

    const db = getDb();
    const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString().replace("T", " ").slice(0, 19);
    const recentFailures = await db.select({ id: authLoginAttempts.id })
      .from(authLoginAttempts)
      .where(and(
        eq(authLoginAttempts.email, email),
        eq(authLoginAttempts.ipAddress, ipAddress),
        eq(authLoginAttempts.successful, false),
        gte(authLoginAttempts.createdAt, cutoff),
      ))
      .orderBy(desc(authLoginAttempts.id))
      .limit(MAX_ATTEMPTS);
    if (recentFailures.length >= MAX_ATTEMPTS) {
      return Response.json({ error: "Muitas tentativas. Aguarde 15 minutos e tente novamente." }, { status: 429 });
    }

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const valid = Boolean(user && user.status === "Ativo" && await verifyPassword(password, user.passwordHash));
    await db.insert(authLoginAttempts).values({ email, ipAddress, successful: valid });
    if (!valid || !user) {
      return Response.json({ error: "E-mail ou senha invalidos." }, { status: 401 });
    }

    const now = new Date().toISOString();
    await db.update(users).set({
      lastLoginAt: now,
      updatedAt: now,
      passwordHash: user.passwordHash.startsWith("pbkdf2_sha256$") ? user.passwordHash : await hashPassword(password),
    }).where(eq(users.id, user.id));
    const session = await createSession(request, user.id);
    return Response.json(
      { authenticated: true, mustChangePassword: user.mustChangePassword },
      { headers: { "Set-Cookie": sessionCookie(session.token, request), "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao entrar.";
    return Response.json({ error: message.includes("no such table") ? "Autenticacao ainda nao foi migrada no banco." : message }, { status: 500 });
  }
}
