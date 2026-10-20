/**
 * Spaced repetition (SM-2 variant). grade: 0 = again, 1 = hard, 2 = good, 3 = easy.
 * Pure function so it can be unit-tested and used on server and client.
 */
export type SrsState = { reps: number; lapses: number; ease: number; interval_days: number };

export function review(s: SrsState, grade: 0 | 1 | 2 | 3, now = new Date()) {
  let { reps, lapses, ease, interval_days } = s;
  if (grade === 0) {
    lapses += 1;
    reps = 0;
    interval_days = 0; // review again in this session (10 minutes)
    ease = Math.max(1.3, ease - 0.2);
  } else {
    reps += 1;
    if (reps === 1) interval_days = grade === 3 ? 3 : 1;
    else if (reps === 2) interval_days = grade === 1 ? 2 : grade === 3 ? 7 : 4;
    else interval_days = Math.min(365, Math.round(interval_days * (grade === 1 ? 1.2 : grade === 3 ? ease * 1.3 : ease) * 10) / 10);
    ease = Math.min(3, Math.max(1.3, ease + (grade === 1 ? -0.15 : grade === 3 ? 0.15 : 0)));
  }
  const due = new Date(now.getTime() + (interval_days === 0 ? 10 * 60_000 : interval_days * 86_400_000));
  return { reps, lapses, ease, interval_days, due_at: due.toISOString() };
}

/** A word counts as mastered after two successful spaced reviews (≥ 4 day interval). */
export const isMastered = (s: { interval_days: number }) => s.interval_days >= 4;
