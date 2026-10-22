import { dbKind } from "@/lib/db";
import { AudioErrorToast } from "@/components/audio-toast";
import type { Metadata, Viewport } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { WordProvider } from "@/components/word-popover";

const inter = Inter({ subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"], variable: "--font-inter", display: "swap" });
const serif = Source_Serif_4({
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
  variable: "--font-serif-display",
  display: "swap",
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: { default: "Yedi İklim A1", template: "%s · Yedi İklim A1" },
  description: "Yedi İklim Türkçe A1 — оқулыққа негізделген интерактивті кітап, AI мұғалім және емтиханға дайындық.",
};

export const viewport: Viewport = {
  themeColor: "#f6f3ec",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="kk" className={`${inter.variable} ${serif.variable}`}>
      <body data-db={dbKind()}>
        <WordProvider>{children}</WordProvider>
        <AudioErrorToast />
      </body>
    </html>
  );
}
