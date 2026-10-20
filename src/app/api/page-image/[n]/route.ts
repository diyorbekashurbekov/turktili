import fs from "node:fs";
import { getSettings } from "@/lib/settings";
import { pageImagePath } from "@/lib/page-image";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ n: string }> }) {
  const n = Number((await params).n);
  if (!(await getSettings()).pageImagesAuthorized) return new Response("Not authorized", { status: 403 });
  const file = Number.isInteger(n) ? pageImagePath(n) : null;
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(fs.readFileSync(file), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=86400" },
  });
}
