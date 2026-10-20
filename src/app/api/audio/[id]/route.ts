import fs from "node:fs";
import path from "node:path";
import { q, dataDir } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const row = q.get<{ filename: string }>("SELECT filename FROM audio_assets WHERE id = ?", id);
  if (!row) return new Response("Not found", { status: 404 });
  const file = path.join(dataDir(), "audio", path.basename(row.filename));
  if (!fs.existsSync(file)) return new Response("Not found", { status: 404 });
  const type = file.endsWith(".mp3") ? "audio/mpeg" : file.endsWith(".ogg") ? "audio/ogg" : file.endsWith(".wav") ? "audio/wav" : "audio/mp4";
  return new Response(fs.readFileSync(file), { headers: { "Content-Type": type, "Cache-Control": "private, max-age=86400" } });
}
