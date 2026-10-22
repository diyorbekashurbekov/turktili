import { currentUser, isGuest } from "@/lib/auth";
import { dbKind } from "@/lib/db";
import { blobEnabled } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Deployment check: which storage this function uses and whether the session resolves. No secrets. */
export async function GET() {
  const user = await currentUser();
  return Response.json(
    { db: dbKind(), blob: blobEnabled(), guest: isGuest(user), user: user.id.slice(0, 6) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
