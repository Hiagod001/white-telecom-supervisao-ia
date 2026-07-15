import { asc } from "drizzle-orm";
import { getDb } from "../../../../db";
import { blipAttendants } from "../../../../db/schema";

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Falha inesperada.";
  const cause = error && typeof error === "object" && "cause" in error
    ? (error as { cause?: { message?: string } }).cause?.message ?? ""
    : "";
  if (`${message} ${cause}`.includes("no such table")) return "Banco D1 ainda não foi migrado para atendentes.";
  return message;
}

function attendantView(row: typeof blipAttendants.$inferSelect) {
  let teams: string[] = [];
  try {
    teams = JSON.parse(row.teamsJson) as string[];
  } catch {
    teams = [];
  }
  return {
    id: row.id,
    identity: row.identity,
    fullName: row.fullName,
    email: row.email,
    team: teams[0] ?? "Atendimento",
    status: row.status,
    source: row.identity.startsWith("manual:") ? "Manual" : "Blip",
  };
}

export async function GET() {
  try {
    const db = getDb();
    const rows = await db.select().from(blipAttendants).orderBy(asc(blipAttendants.fullName)).limit(500);
    return Response.json({ attendants: rows.map(attendantView) });
  } catch (error) {
    const message = routeError(error);
    if (message.includes("ainda não foi migrado")) return Response.json({ attendants: [] });
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { fullName?: string; email?: string; team?: string };
    const fullName = payload.fullName?.trim() ?? "";
    const email = payload.email?.trim().toLowerCase() ?? "";
    const team = payload.team?.trim() ?? "";
    if (!fullName || !team) {
      return Response.json({ error: "Nome e equipe são obrigatórios." }, { status: 400 });
    }

    const db = getDb();
    const [created] = await db.insert(blipAttendants).values({
      identity: `manual:${crypto.randomUUID()}`,
      fullName,
      email,
      teamsJson: JSON.stringify([team]),
      status: "Ativo",
    }).returning();
    return Response.json({ attendant: attendantView(created) }, { status: 201 });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}
