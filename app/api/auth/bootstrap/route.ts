import { env } from "cloudflare:workers";
import { getDb } from "../../../../db";
import { users } from "../../../../db/schema";
import { hashPassword, passwordIsStrong, requireSameOrigin } from "../../../../lib/auth";

type BootstrapEnv = { AUTH_BOOTSTRAP_TOKEN?: string };

export async function GET() {
  try {
    const existing = await getDb().select({ id: users.id }).from(users).limit(1);
    return Response.json({ needsBootstrap: existing.length === 0 }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Falha ao consultar configuracao." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  try {
    const configuredToken = (env as unknown as BootstrapEnv).AUTH_BOOTSTRAP_TOKEN?.trim() ?? "";
    const receivedToken = request.headers.get("x-bootstrap-token")?.trim() ?? "";
    if (!configuredToken || receivedToken !== configuredToken) {
      return Response.json({ error: "Inicializacao nao autorizada." }, { status: 401 });
    }
    const db = getDb();
    const existing = await db.select({ id: users.id }).from(users).limit(1);
    if (existing.length) return Response.json({ error: "O sistema ja possui administrador." }, { status: 409 });
    const payload = (await request.json()) as { name?: string; email?: string; password?: string };
    const name = payload.name?.trim() ?? "";
    const email = payload.email?.trim().toLowerCase() ?? "";
    const password = payload.password ?? "";
    if (!name || !/^\S+@\S+\.\S+$/.test(email) || !passwordIsStrong(password)) {
      return Response.json({ error: "Nome, e-mail valido e senha forte sao obrigatorios." }, { status: 400 });
    }
    const [created] = await db.insert(users).values({
      name,
      email,
      role: "Administrador",
      team: "Administracao",
      passwordHash: await hashPassword(password),
      mustChangePassword: true,
    }).returning({ id: users.id, email: users.email });
    return Response.json({ initialized: true, user: created }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Falha ao criar administrador." }, { status: 500 });
  }
}
