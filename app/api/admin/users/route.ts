import { and, desc, eq, ne } from "drizzle-orm";
import { getDb } from "../../../../db";
import { actionLogs, authSessions, users } from "../../../../db/schema";
import { hashPassword, passwordIsStrong, requireAuth, type UserRole } from "../../../../lib/auth";

const validRoles: UserRole[] = ["Administrador", "Gestor", "Operador"];

function publicFields() {
  return {
    id: users.id,
    name: users.name,
    email: users.email,
    role: users.role,
    team: users.team,
    status: users.status,
    attendantIdentity: users.attendantIdentity,
    mustChangePassword: users.mustChangePassword,
    lastLoginAt: users.lastLoginAt,
    createdAt: users.createdAt,
    updatedAt: users.updatedAt,
  };
}

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Erro inesperado";
  if (message.includes("UNIQUE constraint failed")) return "Ja existe um usuario com este e-mail.";
  if (message.includes("no such table")) return "Banco D1 ainda nao esta migrado para autenticacao.";
  return message;
}

export async function GET(request: Request) {
  const auth = await requireAuth(request, ["Administrador"]);
  if (auth.response) return auth.response;
  try {
    const rows = await getDb().select(publicFields()).from(users).orderBy(desc(users.id)).limit(250);
    return Response.json({ users: rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth(request, ["Administrador"]);
  if (auth.response || !auth.user) return auth.response;
  try {
    const payload = (await request.json()) as {
      name?: string;
      email?: string;
      role?: UserRole;
      team?: string;
      password?: string;
      attendantIdentity?: string;
    };
    const name = payload.name?.trim() ?? "";
    const email = payload.email?.trim().toLowerCase() ?? "";
    const role = payload.role ?? "Operador";
    const team = payload.team?.trim() ?? "Operacao";
    const password = payload.password ?? "";
    if (!name || !/^\S+@\S+\.\S+$/.test(email) || !validRoles.includes(role)) {
      return Response.json({ error: "Nome, e-mail valido e perfil sao obrigatorios." }, { status: 400 });
    }
    if (!passwordIsStrong(password)) {
      return Response.json({ error: "A senha temporaria deve ter 12 caracteres, maiuscula, minuscula, numero e simbolo." }, { status: 400 });
    }

    const db = getDb();
    const [created] = await db.insert(users).values({
      name,
      email,
      role,
      team,
      attendantIdentity: payload.attendantIdentity?.trim() ?? "",
      passwordHash: await hashPassword(password),
      mustChangePassword: true,
    }).returning(publicFields());
    await db.insert(actionLogs).values({
      action: "user_created",
      targetType: "user",
      targetId: String(created.id),
      note: `${created.email} - ${created.role}`,
      actorUserId: auth.user.id,
      actorName: auth.user.name,
    });
    return Response.json({ user: created }, { status: 201 });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAuth(request, ["Administrador"]);
  if (auth.response || !auth.user) return auth.response;
  try {
    const payload = (await request.json()) as {
      id?: number;
      name?: string;
      email?: string;
      role?: UserRole;
      team?: string;
      status?: "Ativo" | "Bloqueado";
      attendantIdentity?: string;
      temporaryPassword?: string;
    };
    if (!payload.id) return Response.json({ error: "Usuario obrigatorio." }, { status: 400 });
    if (payload.name !== undefined && !payload.name.trim()) return Response.json({ error: "Nome nao pode ficar vazio." }, { status: 400 });
    if (payload.email !== undefined && !/^\S+@\S+\.\S+$/.test(payload.email.trim())) return Response.json({ error: "E-mail invalido." }, { status: 400 });
    if (payload.team !== undefined && !payload.team.trim()) return Response.json({ error: "Equipe nao pode ficar vazia." }, { status: 400 });
    const db = getDb();
    const [target] = await db.select().from(users).where(eq(users.id, payload.id)).limit(1);
    if (!target) return Response.json({ error: "Usuario nao encontrado." }, { status: 404 });
    if (payload.role && !validRoles.includes(payload.role)) return Response.json({ error: "Perfil invalido." }, { status: 400 });
    if (payload.status && !["Ativo", "Bloqueado"].includes(payload.status)) return Response.json({ error: "Status invalido." }, { status: 400 });
    if (target.id === auth.user.id && ((payload.role && payload.role !== "Administrador") || payload.status === "Bloqueado")) {
      return Response.json({ error: "Voce nao pode remover o proprio acesso administrativo." }, { status: 400 });
    }
    if (target.role === "Administrador" && (payload.role && payload.role !== "Administrador" || payload.status === "Bloqueado")) {
      const otherAdmins = await db.select({ id: users.id }).from(users).where(and(
        eq(users.role, "Administrador"),
        eq(users.status, "Ativo"),
        ne(users.id, target.id),
      )).limit(1);
      if (!otherAdmins.length) return Response.json({ error: "O sistema precisa manter ao menos um administrador ativo." }, { status: 400 });
    }
    if (payload.temporaryPassword && !passwordIsStrong(payload.temporaryPassword)) {
      return Response.json({ error: "A senha temporaria deve ter 12 caracteres, maiuscula, minuscula, numero e simbolo." }, { status: 400 });
    }
    const now = new Date().toISOString();
    const [updated] = await db.update(users).set({
      name: payload.name?.trim(),
      email: payload.email?.trim().toLowerCase(),
      role: payload.role,
      team: payload.team?.trim(),
      status: payload.status,
      attendantIdentity: payload.attendantIdentity?.trim(),
      passwordHash: payload.temporaryPassword ? await hashPassword(payload.temporaryPassword) : undefined,
      mustChangePassword: payload.temporaryPassword ? true : undefined,
      updatedAt: now,
    }).where(eq(users.id, target.id)).returning(publicFields());

    if (payload.status === "Bloqueado" || payload.temporaryPassword || payload.role) {
      await db.delete(authSessions).where(eq(authSessions.userId, target.id));
    }
    await db.insert(actionLogs).values({
      action: payload.temporaryPassword ? "user_password_reset" : "user_updated",
      targetType: "user",
      targetId: String(target.id),
      note: `${updated.email} - ${updated.role} - ${updated.status}`,
      actorUserId: auth.user.id,
      actorName: auth.user.name,
    });
    return Response.json({ user: updated });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}
