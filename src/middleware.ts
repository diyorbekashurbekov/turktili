import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "yi_sid";

function randomId() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Ensures every visitor has an opaque session id so progress can be saved
// from the first page view (guest), without any registration step.
export function middleware(req: NextRequest) {
  if (req.cookies.get(SESSION_COOKIE)?.value) return NextResponse.next();
  const sid = randomId();
  // make the new cookie visible to server code in this same request
  req.cookies.set(SESSION_COOKIE, sid);
  const res = NextResponse.next({ request: { headers: req.headers } });
  res.cookies.set(SESSION_COOKIE, sid, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
  return res;
}

export const config = {
  matcher: ["/((?!_next/|favicon|icon|.*\\.(?:png|jpg|svg|ico|woff2?)$).*)"],
};
