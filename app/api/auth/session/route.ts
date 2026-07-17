import { getAuthUser } from "../../../../lib/auth";

export async function GET(request: Request) {
  const user = await getAuthUser(request);
  return Response.json(
    user ? { authenticated: true, user } : { authenticated: false, user: null },
    { status: user ? 200 : 401, headers: { "Cache-Control": "no-store" } },
  );
}
