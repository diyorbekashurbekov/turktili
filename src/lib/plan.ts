/**
 * Focus Mode study-plan generator. Pure and deterministic so it can be unit tested.
 * Study phase covers units in priority order, the review phase ends with mock exams.
 */
export type UnitStatus = { unit: number; pagesDone: number; pagesTotal: number; accuracy: number | null; from: number; to: number };
export type PlanTask = { day: string; position: number; kind: string; ref: string; title: string; minutes: number };

const UNIT_TR: Record<number, string> = {
  1: "Tanışma", 2: "Ailemiz", 3: "Günlük Hayat", 4: "Çevremiz", 5: "Meslekler", 6: "Ulaşım", 7: "İletişim", 8: "Tatil",
};

export function daysBetween(a: string, b: string) {
  const d1 = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
  const d2 = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
  return Math.round((d2 - d1) / 86_400_000);
}

export function addDays(iso: string, n: number) {
  const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) + n * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/** Units sorted so that unfinished and weak units come first, keeping textbook order otherwise. */
export function prioritize(units: UnitStatus[]) {
  const score = (u: UnitStatus) => {
    const done = u.pagesTotal ? u.pagesDone / u.pagesTotal : 0;
    const acc = u.accuracy ?? 0.5;
    return done * 0.6 + acc * 0.4; // lower = needs more work
  };
  return [...units].sort((a, b) => {
    const diff = score(a) - score(b);
    return Math.abs(diff) > 0.15 ? diff : a.unit - b.unit;
  });
}

export function isStrong(u: UnitStatus) {
  return u.pagesTotal > 0 && u.pagesDone / u.pagesTotal >= 0.8 && (u.accuracy ?? 0) >= 0.8;
}

export function buildPlan(startDate: string, examDate: string, units: UnitStatus[]): PlanTask[] {
  const total = Math.max(1, daysBetween(startDate, examDate)); // the exam day itself is not a study day
  const tasks: PlanTask[] = [];
  const reviewDays = total >= 14 ? 3 : total >= 7 ? 2 : total >= 3 ? 1 : 0;
  const studyDays = Math.max(1, total - reviewDays);
  const ordered = prioritize(units);
  // strong units get a light review slot instead of a full study block
  const blocks: { u: UnitStatus; light: boolean }[] = ordered.map((u) => ({ u, light: isStrong(u) }));
  const perDay = Math.ceil(blocks.length / studyDays);

  let day = 0;
  for (let i = 0; i < blocks.length; i += perDay) {
    const date = addDays(startDate, Math.min(day, studyDays - 1));
    const todays = blocks.slice(i, i + perDay);
    let pos = tasks.filter((t) => t.day === date).length;
    const push = (kind: string, ref: string, title: string, minutes: number) => tasks.push({ day: date, position: pos++, kind, ref, title, minutes });
    push("vocab", "due", "Сөздерді қайталау (spaced repetition)", 10);
    for (const { u, light } of todays) {
      const name = `${u.unit}-тарау · ${UNIT_TR[u.unit]}`;
      if (light) {
        push("vocab", `unit:${u.unit}`, `${name}: Kelime Dünyası шолу`, 10);
        push("gramer", `${u.unit}`, `${name}: грамматика тесті`, 10);
        continue;
      }
      push("pages", `${u.from}-${u.to}`, `${name}: кітап беттері ${u.from}–${u.to}`, 25);
      push("vocab", `unit:${u.unit}`, `${name}: Kelime Dünyası`, 10);
      push("okuma", `${u.unit}`, `${name}: оқу жаттығуы`, 10);
      push("dinleme", `${u.unit}`, `${name}: тыңдау жаттығуы`, 10);
      push("gramer", `${u.unit}`, `${name}: грамматика`, 10);
      push(u.unit % 2 ? "yazma" : "konusma", `${u.unit}`, u.unit % 2 ? `${name}: жазу (AI кері байланыс)` : `${name}: сөйлеу (AI серіктес)`, 15);
    }
    day++;
  }
  // review phase
  for (let r = 0; r < reviewDays; r++) {
    const date = addDays(startDate, studyDays + r);
    let pos = 0;
    const push = (kind: string, ref: string, title: string, minutes: number) => tasks.push({ day: date, position: pos++, kind, ref, title, minutes });
    push("vocab", "due", "Сөздерді қайталау", 15);
    push("mistakes", "all", "Қателерді қайталау", 15);
    if (r === reviewDays - 1) push("exam", "full", "Толық сынақ емтиханы (4 дағды)", 75);
    else {
      const skill = ["okuma", "dinleme", "yazma", "konusma"][r % 4];
      push("exam", skill, `Сынақ емтиханы: ${skill}`, 20);
      push("konusma", `${ordered[r % ordered.length]?.unit ?? 1}`, "AI-мен сөйлеу жаттығуы", 15);
    }
  }
  return tasks;
}
