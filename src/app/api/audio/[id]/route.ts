import { q } from "@/lib/db";
import { audioKey, audioType, readFile } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const row = await q.get<{ filename: string }>("SELECT filename FROM audio_assets WHERE id = ?", id);
  if (!row) return new Response("Not found", { status: 404 });
  const file = await readFile(audioKey(row.filename));
  if (!file) return new Response("Not found", { status: 404 });
  const body = Buffer.isBuffer(file.body) ? new Uint8Array(file.body) : file.body;
  return new Response(body, {
    headers: {
      "Content-Type": audioType(row.filename),
      ...(file.size ? { "Content-Length": String(file.size) } : {}),
      "Cache-Control": "private, max-age=86400",
    },
  });
}
