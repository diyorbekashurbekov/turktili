import Link from "next/link";
import type { Metadata } from "next";
import { currentUser, isAdmin, isGuest } from "@/lib/auth";
import { overview } from "@/lib/progress";
import { PageShell } from "@/components/shell";
import { AuthForms, LogoutButton, ProfileForm } from "@/components/account";
import { userRequestsToday } from "@/lib/ai";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Hesap" };

const SKILL_KZ: Record<string, string> = { okuma: "Оқу", dinleme: "Тыңдау", gramer: "Грамматика", kelime: "Сөздік", dikte: "Диктант" };
const UNIT_TR = ["", "Tanışma", "Ailemiz", "Günlük Hayat", "Çevremiz", "Meslekler", "Ulaşım", "İletişim", "Tatil"];

export default async function Account() {
  const user = await currentUser();
  const guest = isGuest(user);
  const ov = overview(user.id);
  const s = getSettings();
  const aiUsed = userRequestsToday(user.id);

  return (
    <PageShell userLabel={guest ? "Қонақ" : (user.name ?? "")}>
      <div className="eyebrow">Hesap</div>
      <h1 className="mt-2 font-serif text-4xl">{guest ? "Прогресіңізді сақтаңыз" : `Сәлем, ${user.name ?? ""}`}</h1>

      {guest ? (
        <div className="mt-6 grid gap-10 md:grid-cols-[1fr_1fr]">
          <div className="text-ink-2">
            <p>Қазір қонақ режиміндесіз — прогресс осы құрылғыда сақталып жатыр. Тіркелсеңіз, барлық прогресс аккаунтқа көшеді және кез келген құрылғыдан ашылады.</p>
            <p className="mt-3 text-sm text-ink-3">Тіркеу тегін. Төлем ақпараты сұралмайды.</p>
          </div>
          <AuthForms />
        </div>
      ) : (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span className="text-ink-2">{user.email}</span>
          <LogoutButton />
          {isAdmin(user) && (
            <Link href="/admin" className="btn btn-ghost h-9">
              Әкімші панелі
            </Link>
          )}
        </div>
      )}

      <section className="mt-14">
        <h2 className="eyebrow">Прогресс</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Аяқталған бет" value={`${ov.pagesCompleted}`} sub="192 беттен" />
          <Stat label="Меңгерілген сөз" value={`${ov.wordsMastered}`} sub={`${ov.wordsSeen} сөз көрілді`} />
          <Stat label="Жазу жұмыстары" value={`${ov.writings}`} sub="AI тексеруі" />
          <Stat label="Сөйлеу сессиялары" value={`${ov.speaking}`} sub="AI серіктес" />
        </div>
      </section>

      <section className="mt-10 grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="eyebrow">Дағдылар бойынша дәлдік</h2>
          <ul className="mt-4 space-y-3">
            {ov.bySkill.length === 0 && <li className="text-sm text-ink-3">Әзірге жаттығу жоқ.</li>}
            {ov.bySkill.map((b) => (
              <li key={b.skill}>
                <div className="flex justify-between text-sm">
                  <span>{SKILL_KZ[b.skill] ?? b.skill}</span>
                  <span className="tabular-nums text-ink-3">
                    {Math.round((b.ok / b.c) * 100)}% · {b.c}
                  </span>
                </div>
                <div className="progress-track mt-1.5">
                  <div className="progress-fill" style={{ width: `${(b.ok / b.c) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
          {ov.mistakes > 0 && (
            <Link href="/hatalar" className="btn btn-ghost mt-5 h-9">
              {ov.mistakes} түзетілмеген қате
            </Link>
          )}
        </div>
        <div>
          <h2 className="eyebrow">Тараулар</h2>
          <ul className="mt-4 space-y-3">
            {ov.units.map((u) => (
              <li key={u.unit}>
                <div className="flex justify-between text-sm">
                  <Link href={`/kitap/${u.from}`} className="hover:text-teal">
                    {u.unit}. {UNIT_TR[u.unit]}
                  </Link>
                  <span className="tabular-nums text-ink-3">
                    {u.pagesDone}/{u.pagesTotal}
                    {u.accuracy !== null ? ` · ${Math.round(u.accuracy * 100)}%` : ""}
                  </span>
                </div>
                <div className="progress-track mt-1.5">
                  <div className="progress-fill" style={{ width: `${(u.pagesDone / u.pagesTotal) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {!guest && (
        <section className="mt-14">
          <h2 className="eyebrow">Баптаулар</h2>
          <ProfileForm name={user.name ?? ""} examDate={user.exam_date} />
        </section>
      )}

      <p className="mt-12 text-xs text-ink-3">
        AI сұраулары бүгін: {aiUsed} / {guest ? s.guestDailyRequests : s.memberDailyRequests}
      </p>
    </PageShell>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card p-5">
      <div className="text-xs text-ink-3">{label}</div>
      <div className="mt-2 font-serif text-3xl">{value}</div>
      <div className="mt-1 text-xs text-ink-3">{sub}</div>
    </div>
  );
}
