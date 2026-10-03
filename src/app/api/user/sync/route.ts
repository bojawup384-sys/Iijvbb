import { json, serverError } from "@/lib/http";
import { verifyRequest } from "@/lib/server-auth";
import { ensureUser, getProfile } from "@/lib/usage";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await verifyRequest(req);
  if (!user) return json(401, { code: "UNAUTHENTICATED" });

  let body: {
    displayName?: string | null;
    photoUrl?: string | null;
    locale?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body ok */
  }

  try {
    await ensureUser(user, {
      displayName: body.displayName ?? user.name ?? null,
      photoUrl: body.photoUrl ?? user.picture ?? null,
      locale: body.locale ?? "ar",
    });
    const profile = await getProfile(user.uid);
    return json(200, { ok: true, profile });
  } catch (e) {
    return serverError("sync", e, "DB");
  }
}
