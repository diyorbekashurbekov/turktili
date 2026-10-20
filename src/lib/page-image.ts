import "server-only";
import fs from "node:fs";
import path from "node:path";

/** Original page scans are served only from a private directory and only when rights are confirmed. */
export function pageImagePath(n: number) {
  const dir = process.env.BOOK_PAGES_DIR;
  if (!dir) return null;
  const f = path.join(dir, `p${String(n).padStart(3, "0")}.jpg`);
  return fs.existsSync(f) ? f : null;
}
