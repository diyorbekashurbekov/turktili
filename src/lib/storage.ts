import "server-only";
import fs from "node:fs";
import path from "node:path";
import { dataDir } from "./db";

/**
 * File storage for generated TTS audio and authorised uploads.
 *  - BLOB_READ_WRITE_TOKEN set → Vercel Blob, private store. Files are streamed through
 *    the app's own routes, so uploaded book audio never gets a public URL.
 *  - otherwise → DATA_DIR on local disk (development, Railway volume).
 */
export const blobEnabled = () => !!process.env.BLOB_READ_WRITE_TOKEN;

export type StoredFile = { body: ReadableStream<Uint8Array> | Buffer; size: number | null };

const localPath = (key: string) => path.join(dataDir(), ...key.split("/").map((p) => path.basename(p)));

export async function readFile(key: string): Promise<StoredFile | null> {
  if (blobEnabled()) {
    const { get } = await import("@vercel/blob");
    const r = await get(key, { access: "private" }).catch(() => null);
    if (!r || r.statusCode !== 200) return null;
    return { body: r.stream, size: r.blob.size };
  }
  const f = localPath(key);
  if (!fs.existsSync(f)) return null;
  const buf = fs.readFileSync(f);
  return { body: buf, size: buf.length };
}

export async function saveFile(key: string, data: Buffer, contentType: string) {
  if (blobEnabled()) {
    const { put } = await import("@vercel/blob");
    await put(key, data, { access: "private", contentType, addRandomSuffix: false, allowOverwrite: true });
    return;
  }
  const f = localPath(key);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, data);
}

/** Storage key of an uploaded book-audio asset (older rows stored only the file name). */
export const audioKey = (filename: string) => (filename.includes("/") ? filename : `audio/${filename}`);

export const audioType = (name: string) =>
  name.endsWith(".mp3") ? "audio/mpeg" : name.endsWith(".ogg") ? "audio/ogg" : name.endsWith(".wav") ? "audio/wav" : "audio/mp4";

export async function deleteFile(key: string) {
  if (blobEnabled()) {
    const { del } = await import("@vercel/blob");
    await del(key).catch(() => undefined);
    return;
  }
  fs.rmSync(localPath(key), { force: true });
}
