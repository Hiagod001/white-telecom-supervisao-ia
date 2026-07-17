import { and, eq, gt } from "drizzle-orm";
import { getDb } from "../db";
import { authSessions, users } from "../db/schema";

export const SESSION_COOKIE = "uai_session";
const PASSWORD_ITERATIONS = 310_000;
const SESSION_HOURS = 12;

export type UserRole = "Administrador" | "Gestor" | "Operador";
export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  team: string;
  status: string;
  attendantIdentity: string;
  mustChangePassword: boolean;
  permissions: string[];
};

const permissionsByRole: Record<UserRole, string[]> = {
  Administrador: ["admin", "users:manage", "integrations:manage", "processes:manage", "operations:manage", "tasks:manage", "ai:use"],
  Gestor: ["operations:view", "operations:manage", "processes:view", "tasks:manage", "ai:use"],
  Operador: ["operations:self", "tasks:self", "ai:use"],
};

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PASSWORD_ITERATIONS },
    key,
    256,
  );
  return `pbkdf2_sha256$${PASSWORD_ITERATIONS}$${bytesToBase64Url(salt)}$${bytesToBase64Url(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, iterationsText, saltText, expectedText] = storedHash.split("$");
  if (algorithm === "pbkdf2_sha256" && iterationsText && saltText && expectedText) {
    const iterations = Number(iterationsText);
    if (!Number.isInteger(iterations) || iterations < 100_000 || iterations > 1_000_000) return false;
    const salt = base64UrlToBytes(saltText);
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
    return constantTimeEqual(new Uint8Array(bits), base64UrlToBytes(expectedText));
  }

  // Upgrade path for accounts created by the old SHA-256-only implementation.
  if (/^[a-f0-9]{64}$/i.test(storedHash)) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
    const legacy = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return legacy === storedHash.toLowerCase();
  }
  return false;
}

export function passwordIsStrong(password: string) {
  return password.length >= 12 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
}

export function clientIp(request: Request) {
  return (request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0] ?? "").trim().slice(0, 80);
}

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) ?? "";
}

function secureRequest(request: Request) {
  return request.headers.get("x-forwarded-proto") === "https" || new URL(request.url).protocol === "https:";
}

export function sessionCookie(token: string, request: Request, maxAgeSeconds = SESSION_HOURS * 3600) {
  return [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secureRequest(request) ? "Secure" : "",
    `Max-Age=${maxAgeSeconds}`,
  ].filter(Boolean).join("; ");
}

export function clearSessionCookie(request: Request) {
  return sessionCookie("", request, 0);
}

export async function createSession(request: Request, userId: number) {
  const token = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600 * 1000).toISOString();
  await getDb().insert(authSessions).values({
    id: crypto.randomUUID(),
    userId,
    tokenHash,
    expiresAt,
    ipAddress: clientIp(request),
    userAgent: (request.headers.get("user-agent") ?? "").slice(0, 500),
  });
  return { token, tokenHash, expiresAt };
}

export async function revokeRequestSession(request: Request) {
  const token = cookieValue(request, SESSION_COOKIE);
  if (token) await getDb().delete(authSessions).where(eq(authSessions.tokenHash, await sha256(token)));
}

export async function getAuthUser(request: Request): Promise<AuthUser | null> {
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token) return null;
  const db = getDb();
  const [session] = await db.select().from(authSessions).where(and(
    eq(authSessions.tokenHash, await sha256(token)),
    gt(authSessions.expiresAt, new Date().toISOString()),
  )).limit(1);
  if (!session) return null;
  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (!user || user.status !== "Ativo" || !permissionsByRole[user.role as UserRole]) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
    team: user.team,
    status: user.status,
    attendantIdentity: user.attendantIdentity,
    mustChangePassword: user.mustChangePassword,
    permissions: permissionsByRole[user.role as UserRole],
  };
}

function validOrigin(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const requestHost = request.headers.get("host") ?? new URL(request.url).host;
  try {
    return new URL(origin).host === requestHost;
  } catch {
    return false;
  }
}

export function requireSameOrigin(request: Request) {
  return validOrigin(request) ? null : Response.json({ error: "Origem da requisicao nao permitida." }, { status: 403 });
}

export async function requireAuth(request: Request, allowedRoles?: UserRole[]) {
  if (!validOrigin(request)) {
    return { user: null, response: Response.json({ error: "Origem da requisicao nao permitida." }, { status: 403 }) };
  }
  const user = await getAuthUser(request);
  if (!user) {
    return { user: null, response: Response.json({ error: "Autenticacao obrigatoria." }, { status: 401 }) };
  }
  if (user.mustChangePassword && !new URL(request.url).pathname.startsWith("/api/auth/")) {
    return { user: null, response: Response.json({ error: "Troque sua senha temporaria antes de continuar." }, { status: 403 }) };
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return { user: null, response: Response.json({ error: "Seu perfil nao possui permissao para esta acao." }, { status: 403 }) };
  }
  return { user, response: null };
}
