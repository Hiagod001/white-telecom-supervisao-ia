import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("authentication uses strong password hashing and server-side sessions", async () => {
  const [auth, schema, migration, login, logout, password, bootstrap] = await Promise.all([
    readFile(new URL("../lib/auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0003_watery_cammi.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/login/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/logout/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/password/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/bootstrap/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(auth, /PBKDF2/);
  assert.match(auth, /310_000/);
  assert.match(auth, /getRandomValues\(new Uint8Array\(16\)\)/);
  assert.match(auth, /HttpOnly/);
  assert.match(auth, /SameSite=Lax/);
  assert.match(auth, /Secure/);
  assert.match(auth, /tokenHash/);
  assert.match(auth, /request\.headers\.get\("host"\)/);
  assert.doesNotMatch(auth, /x-forwarded-host/);
  assert.match(schema, /authSessions/);
  assert.match(schema, /authLoginAttempts/);
  assert.match(migration, /CREATE TABLE `auth_sessions`/);
  assert.match(login, /MAX_ATTEMPTS = 5/);
  assert.match(logout, /requireAuth\(request/);
  assert.match(password, /mustChangePassword: false/);
  assert.match(bootstrap, /AUTH_BOOTSTRAP_TOKEN/);
  assert.match(bootstrap, /mustChangePassword: true/);
});

test("all operational APIs enforce authentication and admin routes enforce roles", async () => {
  const protectedRoutes = [
    "actions",
    "tasks",
    "conversations/imported",
    "conversations/messages",
    "admin/users",
    "admin/attendants",
    "admin/integrations",
    "admin/processes",
    "admin/processes/documents",
    "admin/integrations/blip/test",
    "admin/integrations/blip/sync",
    "admin/analysis/run",
  ];
  for (const route of protectedRoutes) {
    const source = await readFile(new URL(`../app/api/${route}/route.ts`, import.meta.url), "utf8");
    assert.match(source, /requireAuth\(request/, `${route} must require authentication`);
  }

  const [actionsRoute, usersRoute, tasksRoute, conversationsRoute, webhook] = await Promise.all([
    readFile(new URL("../app/api/actions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/users/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/tasks/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/conversations/imported/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/integrations/blip/webhook/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(actionsRoute, /operatorActions/);
  assert.match(usersRoute, /\["Administrador"\]/);
  assert.match(usersRoute, /ao menos um administrador ativo/);
  assert.match(tasksRoute, /Voce so pode atualizar as proprias tarefas/);
  assert.match(conversationsRoute, /attendantIdentity/);
  assert.match(webhook, /if \(!expectedSecret\)/);
});

test("the client renders real login and no longer exposes role switching", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /Acesse sua conta/);
  assert.match(page, /\/api\/auth\/session/);
  assert.match(page, /\/api\/auth\/login/);
  assert.match(page, /\/api\/auth\/logout/);
  assert.match(page, /Crie uma nova senha/);
  assert.doesNotMatch(page, /const changeRole/);
  assert.doesNotMatch(page, /Visualização atual/);
});
