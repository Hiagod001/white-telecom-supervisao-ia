import { desc } from "drizzle-orm";
import { getDb } from "../../../../db";
import { users } from "../../../../db/schema";

async function hashPassword(password: string) {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message.includes("no such table")) {
    return "Banco D1 ainda nao esta migrado. Gere e publique as migracoes antes de usar os cadastros reais.";
  }
  return message;
}

export async function GET() {
  try {
    const db = getDb();
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        team: users.team,
        status: users.status,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.id))
      .limit(100);

    return Response.json({ users: rows });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      name?: string;
      email?: string;
      role?: string;
      team?: string;
      password?: string;
    };
    const name = payload.name?.trim() ?? "";
    const email = payload.email?.trim().toLowerCase() ?? "";
    const role = payload.role?.trim() ?? "Operador";
    const team = payload.team?.trim() ?? "Operacao";
    const password = payload.password ?? "";

    if (!name || !email || password.length < 6) {
      return Response.json(
        { error: "Nome, email e senha com pelo menos 6 caracteres sao obrigatorios." },
        { status: 400 },
      );
    }

    const db = getDb();
    const [created] = await db
      .insert(users)
      .values({
        name,
        email,
        role,
        team,
        passwordHash: await hashPassword(password),
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        team: users.team,
        status: users.status,
        createdAt: users.createdAt,
      });

    return Response.json({ user: created }, { status: 201 });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}
