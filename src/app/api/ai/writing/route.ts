import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { friendlyAiError, generate, guard, logUsage } from "@/lib/ai";
import { q } from "@/lib/db";
import { PRACTICE } from "@/content/practice";
import { pageDigest } from "@/content";

export const runtime = "nodejs";

const Body = z.object({
  promptId: z.string().max(40),
  text: z.string().min(3).max(3000),

});

const WRITING_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary_kz", "corrected_text", "issues", "strengths_kz", "next_steps_kz", "rubric"],
  properties: {
    summary_kz: { type: "string", description: "2-3 sentence overall feedback in Kazakh" },
    corrected_text: { type: "string", description: "The student's text with minimal corrections, A1 level, in Turkish" },
    issues: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["original", "corrected", "type", "explanation_kz"],
        properties: {
          original: { type: "string" },
          corrected: { type: "string" },
          type: { type: "string", enum: ["grammar", "vocabulary", "spelling", "word_order", "punctuation"] },
          explanation_kz: { type: "string" },
        },
      },
    },
    strengths_kz: { type: "array", items: { type: "string" } },
    next_steps_kz: { type: "array", items: { type: "string" } },
    improved_example: { type: "string", description: "A short improved A1 model text in Turkish on the same task" },
    rubric: {
      type: "object",
      additionalProperties: false,
      required: ["task", "grammar", "vocabulary", "coherence"],
      properties: {
        task: { type: "integer", minimum: 0, maximum: 4 },
        grammar: { type: "integer", minimum: 0, maximum: 4 },
        vocabulary: { type: "integer", minimum: 0, maximum: 4 },
        coherence: { type: "integer", minimum: 0, maximum: 4 },
      },
    },
  },
} as const;

const SYSTEM = `You evaluate short A1 Turkish writing by Kazakh university students (Yedi İklim A1 textbook).
- Judge only against A1 expectations and the task. Never require structures beyond A1.
- Correct minimally: keep the student's words where they are acceptable.
- Every issue: the exact original fragment, the corrected fragment, a type, and a short Kazakh explanation.
- Rubric (practice rubric, 0–4 each): task completion, grammar accuracy, vocabulary range/accuracy, coherence. This is NOT an official exam score.
- If the text is not Turkish or off-task, say so in summary_kz and score task 0.`;

export async function POST(req: Request) {
  const user = await currentUser();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Мәтін тым қысқа немесе пішім қате." }, { status: 400 });
  const { promptId, text } = parsed.data;
  const task = PRACTICE.flatMap((p) => p.writing.map((w) => ({ ...w, unit: p.unit }))).find((w) => w.id === promptId);
  if (!task) return Response.json({ error: "Тапсырма табылмады." }, { status: 404 });

  const g = guard(user, "writing");
  if (!g.ok) {
    // keep the student's work even when AI is unavailable
    q.run("INSERT INTO writings (user_id, prompt_id, text, feedback) VALUES (?,?,?,NULL)", user.id, promptId, text);
    return Response.json({ error: g.message, code: g.code, saved: true }, { status: g.status });
  }

  try {
    const { res, model } = await generate(g.textModel, {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `TASK (Ünite ${task.unit}): ${task.tr} — ${task.kz}
Focus: ${task.focus}. Expected: at least ${task.minSentences} sentences.

Relevant textbook context:
${pageDigest(task.pages[0], 2500)}

STUDENT TEXT:
${text}`,
            },
          ],
        },
      ],
      config: { systemInstruction: SYSTEM, responseMimeType: "application/json", responseJsonSchema: WRITING_SCHEMA, maxOutputTokens: 4000 },
    });
    logUsage(user, "writing", model, res.usageMetadata ?? null);
    const feedback = JSON.parse(res.text ?? "null");
    if (!feedback?.corrected_text) throw new Error("Empty feedback");
    const info = q.run("INSERT INTO writings (user_id, prompt_id, text, feedback) VALUES (?,?,?,?)", user.id, promptId, text, JSON.stringify(feedback));
    return Response.json({ id: Number(info.lastInsertRowid), feedback, pages: task.pages });
  } catch (err) {
    logUsage(user, "writing", g.textModel, null, err);
    q.run("INSERT INTO writings (user_id, prompt_id, text, feedback) VALUES (?,?,?,NULL)", user.id, promptId, text);
    return Response.json({ error: friendlyAiError(err), saved: true }, { status: 502 });
  }
}
