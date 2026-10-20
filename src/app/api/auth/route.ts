import { z } from "zod";
import { headers } from "next/headers";
import { login, logout, rateLimit, register } from "@/lib/auth";

export const runtime = "nodejs";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("register"), email: z.string().email().max(120), password: z.string().min(8).max(200), name: z.string().min(1).max(60) }),
  z.object({ action: z.literal("login"), email: z.string().email().max(120), password: z.string().min(1).max(200) }),
  z.object({ action: z.literal("logout") }),
]);

export async function POST(req: Request) {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit(`auth:${ip}`, 12, 10 * 60_000)) return Response.json({ error: "Тым көп әрекет. 10 минуттан соң қайталаңыз." }, { status: 429 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const msg = first?.path[0] === "password" ? "Құпиясөз кемінде 8 таңба болуы керек." : first?.path[0] === "email" ? "Email дұрыс емес." : "Өрістерді толтырыңыз.";
    return Response.json({ error: msg }, { status: 400 });
  }
  const b = parsed.data;
  if (b.action === "logout") {
    await logout();
    return Response.json({ ok: true });
  }
  const res = b.action === "register" ? await register(b.email, b.password, b.name) : await login(b.email, b.password);
  return Response.json(res, { status: res.ok ? 200 : 400 });
}
