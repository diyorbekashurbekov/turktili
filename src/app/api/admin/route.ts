import path from "node:path";
import crypto from "node:crypto";
import { z } from "zod";
import { currentUser, isAdmin } from "@/lib/auth";
import { q } from "@/lib/db";
import { audioKey, audioType, deleteFile, saveFile } from "@/lib/storage";
import { getSettings, setSetting, TEXT_MODELS, TTS_MODELS } from "@/lib/settings";
import { invalidateOverrides, invalidateVocab } from "@/content";

export const runtime = "nodejs";

const Action = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("settings"),
    aiEnabled: z.boolean(),
    textModel: z.string().refine((m) => TEXT_MODELS.includes(m)),
    ttsModel: z.string().refine((m) => TTS_MODELS.includes(m)),
    ttsDailyPerUser: z.number().int().min(0).max(5000),
    dailyBudgetUsd: z.number().min(0).max(10000),
    guestDailyRequests: z.number().int().min(0).max(1000),
    memberDailyRequests: z.number().int().min(0).max(5000),
    pageImagesAuthorized: z.boolean(),
  }),
  z.object({
    action: z.literal("exam"),
    exam: z.object({
      readingQuestions: z.number().int().min(1).max(40),
      listeningQuestions: z.number().int().min(1).max(32),
      grammarQuestions: z.number().int().min(1).max(64),
      vocabQuestions: z.number().int().min(1).max(60),
      writingTasks: z.number().int().min(0).max(3),
      speakingQuestions: z.number().int().min(1).max(10),
      minutes: z.object({ okuma: z.number().int(), dinleme: z.number().int(), yazma: z.number().int(), konusma: z.number().int(), full: z.number().int() }),
    }),
  }),
  z.object({ action: z.literal("page-override"), page: z.number().int().min(1).max(192), field: z.string().regex(/^(title|summary|block:\d+)$/), value: z.string().max(20000) }),
  z.object({ action: z.literal("page-override-clear"), page: z.number().int(), field: z.string() }),
  z.object({ action: z.literal("vocab-override"), wordId: z.string().max(12), tr: z.string().min(1).max(120), kz: z.string().min(1).max(200) }),
  z.object({ action: z.literal("user"), userId: z.string(), disabled: z.boolean().optional(), role: z.enum(["student", "admin"]).optional() }),
  z.object({ action: z.literal("audio-delete"), id: z.number().int() }),
  // registers a file the admin's browser uploaded directly to Vercel Blob (see /api/admin/upload)
  z.object({
    action: z.literal("audio-register"),
    page: z.number().int().min(1).max(192),
    title: z.string().min(1).max(120),
    key: z.string().regex(/^audio\/[\w.-]+\.(mp3|m4a|ogg|wav)$/i),
  }),
  z.object({ action: z.literal("errors-clear") }),
]);

async function requireAdmin() {
  const u = await currentUser();
  return isAdmin(u) ? u : null;
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "forbidden" }, { status: 403 });

  // multipart: authorized audio upload
  if (req.headers.get("content-type")?.startsWith("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    const page = Number(form.get("page"));
    const title = String(form.get("title") || "").slice(0, 120);
    if (!(file instanceof File) || !page || page < 1 || page > 192 || !title) return Response.json({ error: "Файл, бет және атау қажет." }, { status: 400 });
    const ext = path.extname(file.name).toLowerCase();
    if (![".mp3", ".m4a", ".ogg", ".wav"].includes(ext) || file.size > 30 * 1024 * 1024) return Response.json({ error: "mp3/m4a/ogg/wav, 30 МБ дейін." }, { status: 400 });
    const key = `audio/${page}-${crypto.randomBytes(6).toString("hex")}${ext}`;
    await saveFile(key, Buffer.from(await file.arrayBuffer()), audioType(ext));
    await q.run("INSERT INTO audio_assets (page, title, filename) VALUES (?,?,?)", page, title, key);
    return Response.json({ ok: true });
  }

  const parsed = Action.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "bad request" }, { status: 400 });
  const a = parsed.data;
  switch (a.action) {
    case "settings": {
      const { action: _action, ...rest } = a;
      void _action;
      for (const [k, v] of Object.entries(rest)) await setSetting(k as keyof typeof rest, v as never);
      break;
    }
    case "exam":
      await setSetting("exam", { ...(await getSettings()).exam, ...a.exam });
      break;
    case "page-override":
      await q.run(
        "INSERT INTO content_overrides (page, field, value, updated_by) VALUES (?,?,?,?) ON CONFLICT(page, field) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = datetime('now')",
        a.page,
        a.field,
        a.value,
        admin.email,
      );
      invalidateOverrides();
      break;
    case "page-override-clear":
      await q.run("DELETE FROM content_overrides WHERE page = ? AND field = ?", a.page, a.field);
      invalidateOverrides();
      break;
    case "vocab-override":
      await q.run(
        "INSERT INTO vocab_overrides (word_id, tr, kz) VALUES (?,?,?) ON CONFLICT(word_id) DO UPDATE SET tr = excluded.tr, kz = excluded.kz, updated_at = datetime('now')",
        a.wordId,
        a.tr,
        a.kz,
      );
      invalidateVocab();
      break;
    case "user":
      if (a.disabled !== undefined) await q.run("UPDATE users SET disabled = ? WHERE id = ?", a.disabled ? 1 : 0, a.userId);
      if (a.role) await q.run("UPDATE users SET role = ? WHERE id = ?", a.role, a.userId);
      break;
    case "audio-delete": {
      const row = await q.get<{ filename: string }>("SELECT filename FROM audio_assets WHERE id = ?", a.id);
      if (row) {
        await deleteFile(audioKey(row.filename));
        await q.run("DELETE FROM audio_assets WHERE id = ?", a.id);
      }
      break;
    }
    case "audio-register":
      await q.run("INSERT INTO audio_assets (page, title, filename) VALUES (?,?,?)", a.page, a.title, a.key);
      break;
    case "errors-clear":
      await q.run("DELETE FROM error_log");
      break;
  }
  return Response.json({ ok: true });
}
