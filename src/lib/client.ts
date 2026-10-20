"use client";

export async function post<T = unknown>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error((data as { error?: string }).error || `HTTP ${res.status}`), { status: res.status, data });
  return data as T;
}

export const track = (body: unknown) => post("/api/progress", body).catch(() => undefined);

/** Normalizes Turkish answers for tolerant comparison (case, punctuation, spaces). */
export function normTr(s: string) {
  return s
    .toLocaleLowerCase("tr")
    .replace(/[’'`]/g, "'")
    .replace(/[.,!?;:«»"“”()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Ignores Turkish diacritics too — for lenient spelling feedback. */
export function foldTr(s: string) {
  return normTr(s).replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i").replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u").replace(/â/g, "a").replace(/î/g, "i").replace(/û/g, "u");
}
