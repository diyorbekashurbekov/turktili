import Link from "next/link";
import type { Metadata } from "next";
import { currentUser, isAdmin } from "@/lib/auth";
import { q } from "@/lib/db";
import { aiConfigured, todaySpendUsd } from "@/lib/ai";
import { getSettings, TEXT_MODELS, TTS_MODELS } from "@/lib/settings";
import { COVERAGE, getPage, vocab } from "@/content";
import { PageShell } from "@/components/shell";
import { AdminSettings, ExamSettings, PageEditor, VocabEditor, UserRow, AudioUpload, AudioDelete, ClearErrors } from "@/components/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin", robots: { index: false } };

const TABS = [
  ["genel", "Шолу"],
  ["icerik", "Мазмұн"],
  ["ai", "AI және шығын"],
  ["sinav", "Емтихан"],
  ["ses", "Аудио"],
  ["kullanici", "Қолданушылар"],
  ["hata", "Қателер"],
] as const;

export default async function Admin({ searchParams }: { searchParams: Promise<{ tab?: string; page?: string; w?: string }> }) {
  const user = await currentUser();
  if (!isAdmin(user))
    return (
      <PageShell>
        <h1 className="font-serif text-3xl">Рұқсат жоқ</h1>
        <p className="mt-3 text-ink-2">
          Әкімші панелі тек ADMIN_EMAILS тізіміндегі тіркелген қолданушыларға ашық. <Link href="/hesap" className="text-teal underline">Кіру</Link>
        </p>
      </PageShell>
    );
  const sp = await searchParams;
  const tab = TABS.some(([k]) => k === sp.tab) ? sp.tab! : "genel";
  const s = getSettings();

  return (
    <PageShell userLabel={user.name ?? ""} wide>
      <div className="eyebrow">Yönetim</div>
      <h1 className="mt-2 font-serif text-4xl">Әкімші панелі</h1>
      <nav className="no-scrollbar mt-8 flex gap-1 overflow-x-auto border-b hairline">
        {TABS.map(([k, label]) => (
          <Link key={k} href={`/admin?tab=${k}`} className={`-mb-px shrink-0 border-b-2 px-3 pb-3 text-sm ${tab === k ? "border-teal text-ink" : "border-transparent text-ink-3 hover:text-ink-2"}`}>
            {label}
          </Link>
        ))}
      </nav>
      <div className="mt-8">
        {tab === "genel" && <Overview />}
        {tab === "icerik" && <Content page={Number(sp.page) || 10} w={sp.w ?? ""} />}
        {tab === "ai" && (
          <div className="space-y-10">
            <div className={`rounded-xl px-4 py-3 text-sm ${aiConfigured() ? "bg-green-soft text-green" : "bg-amber-soft text-amber"}`}>
              {aiConfigured() ? "Gemini API кілті серверде орнатылған (GEMINI_API_KEY)." : "GEMINI_API_KEY орнатылмаған — AI және түрікше дыбыс өшірулі, қалғаны жұмыс істейді."}
            </div>
            <AdminSettings settings={{ aiEnabled: s.aiEnabled, textModel: s.textModel, ttsModel: s.ttsModel, ttsDailyPerUser: s.ttsDailyPerUser, dailyBudgetUsd: s.dailyBudgetUsd, guestDailyRequests: s.guestDailyRequests, memberDailyRequests: s.memberDailyRequests, pageImagesAuthorized: s.pageImagesAuthorized }} textModels={TEXT_MODELS} ttsModels={TTS_MODELS} />
            <Usage />
          </div>
        )}
        {tab === "sinav" && <ExamSettings exam={s.exam} />}
        {tab === "ses" && <Audio />}
        {tab === "kullanici" && <Users />}
        {tab === "hata" && <Errors />}
      </div>
    </PageShell>
  );
}

function Overview() {
  const users = q.get<{ c: number; m: number }>("SELECT COUNT(*) AS c, SUM(email IS NOT NULL) AS m FROM users")!;
  const active = q.get<{ c: number }>("SELECT COUNT(DISTINCT user_id) AS c FROM page_progress WHERE updated_at >= datetime('now','-7 days')")!.c;
  const errors = q.get<{ c: number }>("SELECT COUNT(*) AS c FROM error_log")!.c;
  const c = COVERAGE;
  return (
    <div className="space-y-10">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Box label="Қолданушылар" value={`${users.c}`} sub={`${users.m ?? 0} тіркелген`} />
        <Box label="7 күнде белсенді" value={`${active}`} sub="бет ашқандар" />
        <Box label="AI шығыны бүгін" value={`$${todaySpendUsd().toFixed(2)}`} sub={`лимит $${getSettings().dailyBudgetUsd}`} />
        <Box label="Қате журналы" value={`${errors}`} sub="жазба" />
      </div>
      <section>
        <h2 className="font-serif text-2xl">Кітапты қамту есебі (Page coverage)</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Box label="PDF беттері" value={`${c.totalPdfPages}`} sub="басылған нөмір = PDF нөмірі" />
          <Box label="Өңделген" value={`${c.processed}`} sub={`тексерілген: ${c.verified}`} />
          <Box label="Көрнекі мазмұнды" value={`${c.withVisualContent}`} sub={`бос беттер: ${c.blank.join(", ")}`} />
          <Box label="Қайта қарау керек" value={`${c.needsReview.length}`} sub="аудиосыз/күмәнді жауаптар" />
        </div>
        <div className="mt-4 text-sm text-ink-2">
          Жетіспейтін беттер: {c.missing.length ? c.missing.join(", ") : "жоқ"} · Сөздік: {c.vocabCount} сөз · Kelime Dünyası: {c.kelimeSets} бөлім (аударылмаған: {c.kelimeUnresolved.length})
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {c.needsReview.map((n) => (
            <Link key={n} href={`/admin?tab=icerik&page=${n}`} className="chip hover:border-teal">
              {n}
            </Link>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink-3">
          Қайта қарау тізімі: жауаптары түпнұсқа аудиосыз немесе күмәнмен берілген беттер. Мұғалім түпнұсқа аудио/кілтпен тексеріп, «Мазмұн» бөлімінде түзете алады.
        </p>
      </section>
    </div>
  );
}

function Box({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card p-5">
      <div className="text-xs text-ink-3">{label}</div>
      <div className="mt-2 font-serif text-3xl">{value}</div>
      <div className="mt-1 text-xs text-ink-3">{sub}</div>
    </div>
  );
}

function Content({ page, w }: { page: number; w: string }) {
  const p = getPage(Math.min(192, Math.max(1, page)))!;
  const overrides = q.all<{ field: string; updated_at: string; updated_by: string | null }>("SELECT field, updated_at, updated_by FROM content_overrides WHERE page = ?", p.n);
  const term = w.toLocaleLowerCase("tr");
  const words = term ? vocab().filter((x) => x.tr.toLocaleLowerCase("tr").includes(term) || x.kz.toLowerCase().includes(term)).slice(0, 30) : [];
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
      <PageEditor page={{ n: p.n, title: p.title, blocks: p.blocks, answers: p.answers }} overrides={overrides} />
      <VocabEditor term={w} words={words.map((x) => ({ id: x.id, tr: x.tr, kz: x.kz, page: x.page }))} />
    </div>
  );
}

function Usage() {
  const byDay = q.all<{ d: string; c: number; cost: number; inp: number; out: number; err: number }>(
    "SELECT date(created_at) AS d, COUNT(*) AS c, SUM(cost_usd) AS cost, SUM(input_tokens) AS inp, SUM(output_tokens) AS out, SUM(ok = 0) AS err FROM ai_usage GROUP BY d ORDER BY d DESC LIMIT 14",
  );
  const byRoute = q.all<{ route: string; c: number; cost: number }>("SELECT route, COUNT(*) AS c, SUM(cost_usd) AS cost FROM ai_usage WHERE created_at >= date('now','-7 days') GROUP BY route ORDER BY cost DESC");
  const top = q.all<{ user_id: string; email: string | null; c: number; cost: number }>(
    "SELECT a.user_id, u.email, COUNT(*) AS c, SUM(a.cost_usd) AS cost FROM ai_usage a LEFT JOIN users u ON u.id = a.user_id WHERE a.created_at >= date('now') GROUP BY a.user_id ORDER BY cost DESC LIMIT 10",
  );
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section>
        <h2 className="font-serif text-xl">Күндер бойынша</h2>
        <table className="mt-3 w-full text-sm">
          <thead className="text-left text-xs text-ink-3">
            <tr>
              <th className="py-2">Күн</th>
              <th>Сұрау</th>
              <th>Токен (кіріс/шығыс)</th>
              <th>Қате</th>
              <th className="text-right">$</th>
            </tr>
          </thead>
          <tbody>
            {byDay.length === 0 && (
              <tr>
                <td colSpan={5} className="py-3 text-ink-3">
                  Әзірге AI сұрауы жоқ.
                </td>
              </tr>
            )}
            {byDay.map((r) => (
              <tr key={r.d} className="border-t hairline">
                <td className="py-2">{r.d}</td>
                <td>{r.c}</td>
                <td className="tabular-nums">
                  {r.inp}/{r.out}
                </td>
                <td>{r.err}</td>
                <td className="text-right tabular-nums">{r.cost.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section>
        <h2 className="font-serif text-xl">7 күн · маршрут бойынша</h2>
        <ul className="mt-3 space-y-1 text-sm">
          {byRoute.map((r) => (
            <li key={r.route} className="flex justify-between border-b hairline py-2">
              <span>{r.route}</span>
              <span className="tabular-nums text-ink-2">
                {r.c} · ${r.cost.toFixed(3)}
              </span>
            </li>
          ))}
        </ul>
        <h2 className="mt-8 font-serif text-xl">Бүгін ең көп қолданғандар</h2>
        <ul className="mt-3 space-y-1 text-sm">
          {top.map((r) => (
            <li key={r.user_id} className="flex justify-between border-b hairline py-2">
              <span>{r.email ?? `қонақ ${r.user_id.slice(0, 6)}`}</span>
              <span className="tabular-nums text-ink-2">
                {r.c} · ${r.cost.toFixed(3)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Audio() {
  const rows = q.all<{ id: number; page: number; title: string; uploaded_at: string }>("SELECT id, page, title, uploaded_at FROM audio_assets ORDER BY page");
  return (
    <div className="grid gap-10 lg:grid-cols-[380px_1fr]">
      <AudioUpload />
      <div>
        <h2 className="font-serif text-xl">Жүктелген аудио</h2>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-ink-3">Әзірге түпнұсқа аудио жоқ. Тыңдау жаттығулары TTS арқылы жұмыс істейді.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--line)] rounded-xl border hairline bg-surface">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-4 px-4 py-3 text-sm">
                <span className="w-14 tabular-nums text-ink-3">{r.page}-бет</span>
                <span className="flex-1">{r.title}</span>
                <audio controls preload="none" src={`/api/audio/${r.id}`} className="h-8" />
                <AudioDelete id={r.id} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Users() {
  const rows = q.all<{ id: string; email: string | null; name: string | null; role: string; disabled: number; created_at: string; pages: number }>(
    "SELECT u.id, u.email, u.name, u.role, u.disabled, u.created_at, (SELECT COUNT(*) FROM page_progress p WHERE p.user_id = u.id) AS pages FROM users u WHERE u.email IS NOT NULL ORDER BY u.created_at DESC LIMIT 200",
  );
  const guests = q.get<{ c: number }>("SELECT COUNT(*) AS c FROM users WHERE email IS NULL")!.c;
  return (
    <div>
      <p className="text-sm text-ink-2">
        Тіркелген: {rows.length} · Қонақ сессиялары: {guests}
      </p>
      <ul className="mt-4 divide-y divide-[var(--line)] rounded-xl border hairline bg-surface">
        {rows.map((r) => (
          <UserRow key={r.id} user={r} />
        ))}
      </ul>
    </div>
  );
}

function Errors() {
  const rows = q.all<{ id: number; route: string; message: string; created_at: string }>("SELECT id, route, message, created_at FROM error_log ORDER BY id DESC LIMIT 100");
  return (
    <div>
      <ClearErrors />
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-ink-3">Қате тіркелмеген.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="rounded-xl border hairline bg-surface p-3 text-sm">
              <div className="text-xs text-ink-3">
                {r.created_at} · {r.route}
              </div>
              <div className="mt-1 break-words font-mono text-xs">{r.message}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
