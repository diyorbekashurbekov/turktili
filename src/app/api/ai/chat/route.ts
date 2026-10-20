import type { Content } from "@google/genai";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { friendlyAiError, generateStream, guard, logUsage, TEACHER_SYSTEM } from "@/lib/ai";
import { getPage, pageDigest, searchPages, unitOfPage } from "@/content";
import { q } from "@/lib/db";

export const runtime = "nodejs";
// Gemini calls (and retry waits when rate-limited) can take tens of seconds
export const maxDuration = 60;

const Body = z.object({
  page: z.number().int().min(1).max(192).nullable().optional(),
  mode: z.enum(["free", "explain", "simpler", "example", "quiz", "mistakes"]).default("free"),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) }))
    .min(1)
    .max(30),
});

const MODE_HINT: Record<string, string> = {
  free: "",
  explain: "The student asks to explain the open page. Summarize its learning goal, explain its grammar step by step in Kazakh with Turkish examples, then ask one short comprehension question.",
  simpler: "Re-explain the last explanation much more simply: shorter sentences, everyday Kazakh, one tiny Turkish example.",
  example: "Give 3 new A1 example sentences connected to this page's topic and grammar, each with a Kazakh translation, marked 'Мысал (платформа):'.",
  quiz: "Create a 4-question mini quiz grounded ONLY in the page context (mix multiple choice and fill-in-the-blank). Show questions first; give answers only after the student replies.",
  mistakes: "The student shares mistakes from their practice. Explain each mistake briefly in Kazakh and give one corrected example.",
};

async function recentMistakes(userId: string) {
  return await q.all<{ skill: string; item_id: string; given: string | null }>(
    "SELECT skill, item_id, given FROM attempts WHERE user_id = ? AND correct = 0 AND resolved = 0 ORDER BY id DESC LIMIT 8",
    userId,
  );
}

export async function POST(req: Request) {
  const user = await currentUser();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Сұрау пішімі қате." }, { status: 400 });
  const { page, mode, messages } = parsed.data;

  const g = await guard(user, "chat");
  if (!g.ok) return Response.json({ error: g.message, code: g.code }, { status: g.status });

  const last = messages[messages.length - 1].content;
  // page-aware grounding: open page + an explicitly mentioned page + keyword matches
  const pagesToUse = new Set<number>();
  if (page) pagesToUse.add(page);
  const mentioned = last.match(/(\d{1,3})\s*-?\s*(?:бет|bet|sayfa|page)/i);
  if (mentioned && +mentioned[1] >= 1 && +mentioned[1] <= 192) pagesToUse.add(+mentioned[1]);
  if (pagesToUse.size < 2) for (const n of searchPages(last, 1, page ?? undefined)) pagesToUse.add(n);

  const contextParts = await Promise.all([...pagesToUse].map((n, i) => pageDigest(n, i === 0 ? 7000 : 2500)));
  const open = page ? await getPage(page) : null;
  const mistakes = mode === "mistakes" || mode === "free" ? await recentMistakes(user.id) : [];
  const context = [
    open ? `The student currently has page ${open.n} open (Ünite ${unitOfPage(open.n).id}).` : "The student has no textbook page open.",
    MODE_HINT[mode],
    contextParts.length ? `PAGE CONTEXT (verified analysis):\n\n${contextParts.join("\n\n---\n\n")}` : "PAGE CONTEXT: none available for this question.",
    mistakes.length ? `Recent unresolved practice mistakes (item ids): ${mistakes.map((m) => `${m.skill}:${m.item_id}${m.given ? ` (answered "${m.given}")` : ""}`).join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  // stable system prompt first (implicit prompt caching), page context attached to the latest turn
  const contents: Content[] = messages.map((m, i) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: i === messages.length - 1 ? [{ text: `<context>\n${context}\n</context>` }, { text: m.content }] : [{ text: m.content }],
  }));

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let model = g.textModel;
      try {
        const r = await generateStream(g.textModel, { contents, config: { systemInstruction: TEACHER_SYSTEM, maxOutputTokens: 3000 } }, "normal");
        model = r.model;
        let usage = null;
        let finish: string | undefined;
        for await (const chunk of r.stream) {
          if (chunk.text) controller.enqueue(encoder.encode(chunk.text));
          if (chunk.usageMetadata) usage = chunk.usageMetadata;
          finish = chunk.candidates?.[0]?.finishReason ?? finish;
        }
        if (finish === "MAX_TOKENS") controller.enqueue(encoder.encode("\n\n_…жауап қысқартылды._"));
        if (finish === "SAFETY" || finish === "PROHIBITED_CONTENT") controller.enqueue(encoder.encode("\n\n_Бұл сұраққа жауап бере алмаймын._"));
        await logUsage(user, "chat", model, usage);
      } catch (err) {
        await logUsage(user, "chat", model, null, err);
        controller.enqueue(encoder.encode(`\n\n⚠️ ${friendlyAiError(err)}`));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
