import { clearSessionCookie, requireAuth, revokeRequestSession } from "../../../../lib/auth";

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;
  await revokeRequestSession(request);
  return Response.json(
    { authenticated: false },
    { headers: { "Set-Cookie": clearSessionCookie(request), "Cache-Control": "no-store" } },
  );
}
