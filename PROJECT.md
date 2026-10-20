# Yedi İklim A1 — project document

A textbook-centred learning platform for the Yedi İklim Türkçe A1 book (Yunus Emre Enstitüsü, 192 pages).
It targets first-year Kazakh university students preparing for an A1 exam with four skills: okuma, dinleme, yazma and konuşma.
This file is the hand-off document between sessions. Keep it current.

## Run

```bash
npm install
npm run content      # rebuild src/content/generated/*.json from content/source/analysis.md
npm run dev          # http://localhost:3100
npm test             # unit tests (node --test, TypeScript run natively by Node 24)
npm run e2e          # end-to-end HTTP journeys (needs a running server; BASE=http://… to override)
npm run build && npm start
```

Configuration template: `.env.example` (no secrets). Put real values in `.env.local` (gitignored); `GEMINI_API_KEY` enables the AI teacher, voice and transcription. Users whose emails are listed in `ADMIN_EMAILS` get the admin panel once they register.

Requires **Node ≥ 22.5** for the built-in `node:sqlite`. Development and testing used Node 24.19.

## Architecture decisions

| Area | Decision | Why |
|---|---|---|
| Framework | Next.js 15 App Router, React 19, TypeScript, Tailwind v4, `motion` | Server components keep the 750 KB textbook dataset on the server. Each page ships only its own lesson. |
| Data | SQLite via the built-in `node:sqlite` (`src/lib/db.ts`), file at `DATA_DIR/app.db` | Has no native-build dependency and no external service, which makes it easy to self-host. The SQL is standard, so moving to Postgres later is mechanical. Rows are copied to plain objects because React cannot serialise null-prototype rows. |
| Auth | An opaque session cookie (`middleware.ts`) gives every visitor a guest account at once. Registering upgrades that guest in place, so progress is kept. Passwords use scrypt. | Students can start without any registration step, and nothing is lost when they do register. Login and auth requests are rate-limited. |
| Content | `content/source/analysis.md` (the verified 192-page analysis) → `scripts/build-content.mjs` → `pages.json`, `vocab.json`, `kelime.json`, `units.json`, `coverage.json` | Educational content is kept separate from the UI. Admin overrides (`content_overrides`, `vocab_overrides`) are applied at read time without touching the source. |
| Practice bank | `src/content/practice.ts`: original platform-written reading, listening, grammar, writing and speaking items for units 1–8 | The textbook text is copyrighted, so practice is new material on the same topics and grammar. Every item has a deterministic answer, so grading needs no AI. |
| AI | Google Gemini via the official `@google/genai` SDK, server-side only (`src/lib/ai.ts`). Text model `gemini-2.5-flash` by default (thinking budget per task: 0 for quick speaking turns, 768 for page-aware chat), automatic fallback to `gemini-3.5-flash-lite` on 429/5xx. Models are changeable in admin. | The key never reaches the browser (verified: 0 occurrences in `.next/static`). Per-model thinking config (`thinkingFor`) because 2.5 and 3.x models take different parameters. |
| Grounding | Every chat request includes a digest of the open page, plus any page mentioned by number and one keyword-retrieved page. The system prompt requires citing pages as "(кітап, N-бет)", admitting when information is missing, and labelling the model's own examples "Мысал (платформа)". | Answers stay page-aware and grounded in the source. |
| Structured AI output | Writing feedback and speaking feedback use JSON-schema structured outputs (`responseJsonSchema`). | Feedback is structured (issues, corrections, a practice rubric) rather than a single arbitrary score. |
| Voice output | Gemini TTS (`gemini-3.8-flash-tts`, chain → `3.8-flash-lite-tts` → `3.1-flash-tts-preview`), `languageCode: tr-TR`, female voice Kore / male voice Charon (`src/lib/tts.ts`, `/api/tts`). Each unique text is synthesized once, silence-trimmed and cached on disk (`DATA_DIR/tts`), then served with an immutable cache header. Slow speed = playbackRate 0.7 with pitch preserved. | **Root cause of the unnatural pronunciation:** the browser had no Turkish voice, and setting `lang="tr-TR"` silently fell back to the default English voice. Now a browser voice is used only if it is a real `tr-*` voice; otherwise the user sees an error toast — Turkish is never read by an English voice. Kazakh/Cyrillic text is rejected by the TTS route. |
| Voice input | MediaRecorder + server transcription by Gemini (`/api/ai/transcribe`), level meter and silence auto-stop (`useRecognizer`). A speaking turn sends the audio once to `/api/ai/speak`, which transcribes and replies in one call and pre-synthesizes the reply audio. | Works without a browser speech recognizer (Firefox, iOS). Pronunciation is explicitly **not** measured acoustically. |
| Speaking modes | **Öğretmen**: one A1 question per turn, corrects with "Doğrusu: …" and one Kazakh "Түсіндірме:" sentence (shown, not spoken). **Sohbet**: natural partner, no corrections and no Kazakh during the talk, full feedback at the end. Exam mode uses a neutral examiner. Hands-free option in Sohbet. | Matches the two requested teaching styles. |
| Cost control | A kill switch, a global daily USD budget, per-user daily quotas (guest and member), burst limits (12 AI requests/min, 40 TTS requests/min), a separate per-user daily limit for uncached TTS clips (400), and per-request token and cost logging (`ai_usage`). The admin panel shows spend by day, route and user. | A free A1 platform has to stay within budget. Multiple-choice, dictation, vocabulary and exam grading are all deterministic and cost nothing. |
| Copyright | Original page scans are served only from a private `BOOK_PAGES_DIR` through `/api/page-image/[n]`, and only when "rights confirmed" is enabled in admin. This is off by default. Authorised audio is uploaded through admin. | The original book is never redistributed without permission. |

## Design system

- Warm ivory background (`#f6f3ec`), graphite ink, and one refined turquoise accent (`#12807f`) taken from the book's identity. Hairline borders and very soft shadows.
- Type: Source Serif 4 for display and Inter for UI. Both cover Turkish (ç ğ ı İ ö ş ü) and Kazakh Cyrillic (ә ғ қ ң ө ұ ү һ і).
- The book is the hero. The home page centres on an original typographic cover. The cover opens in 3D before navigating, and this respects reduced-motion settings.
- Reader layout: a chapter rail on the left, a 760 px reading column, and a contextual AI panel on the right. On mobile these become a drawer, a bottom sheet and a floating learning toolbar.
- Progressive disclosure: practice actions sit under one "Жаттығу" menu, and task answers stay hidden until the student asks for them.

## Implemented and verified functionality

- **Home:** book hero, greeting, continue-reading, exam countdown, Focus Mode entry, unit progress.
- **Book:** table of contents (units, sections, grammar, per-page progress), and readers for all 192 pages. Each reader has:
  - lesson, words, notes and original-page (when authorised) tabs;
  - a Kelime Dünyası panel and tappable vocabulary with an instant meaning, TTS and save popover;
  - answers that stay hidden until revealed and carry confidence badges;
  - mark complete, bookmarks, autosaved notes, keyboard ←/→ navigation and a page jump;
  - authorised original audio when uploaded.
- **Four skills × 8 units (`/pratik/[unit]/[skill]`):** reading with tappable words, listening (TTS dialogue, speed control, per-line replay, hidden transcript, questions, dictation with Turkish keys), grammar, writing (AI feedback and history), and speaking (voice conversation, text fallback, mic status, feedback).
- **Kelime Dünyası:** 24 sections from the book (285 items, all glossed in Kazakh) plus 2,420 words. Six practice modes (cards, TR→KZ, KZ→TR, listen-and-choose, spelling, matching) with SM-2 spaced repetition, due reviews and saved words.
- **Exams:** reading, listening, writing, speaking, vocabulary, grammar, unit tests and a full four-skill mock. All are timed and auto-submit. The answer key stays on the server. Reports show per-skill results, mistake explanations, recommended pages and weak units, and history is kept. Structure is configurable in admin.
- **Focus Mode:** 7/14/21-day or exam-date plans that put weak and unread units first, with daily tasks across all skills, review days and a full mock the day before the exam. Missed days lead to a calm offer to recalculate. Includes a week strip and weak-area hints.
- **Mistakes (`/hatalar`):** a later correct answer closes the mistake automatically; links lead to the page, the practice and the AI teacher.
- **Account:** guest, register, login and logout, progress overview, profile and exam date.
- **Admin:** coverage report, page and vocabulary editor with overrides, AI settings (kill switch, model, budget, quotas, page-image rights), usage and cost tables, exam configuration, audio upload, user management and error log.

## Textbook coverage report

| | |
|---|---|
| Total PDF pages | 192 (printed numbering = PDF numbering) |
| Pages processed and verified (read visually, page by page) | 192 / 192, none missing |
| Blank pages | 8, 175 |
| Pages with visual content | 190 |
| Vocabulary entries | 2,420 (2,400 from pages and the Dizin, plus 20 platform-authored glosses in `content/source/supplement.json`) |
| Kelime Dünyası sections | 24, all items resolved |
| Pages needing teacher review | 27. Their suggested answers depend on the book's audio, which was not provided, or are marked uncertain. The admin overview lists them, and the reader shows their answers with an amber badge. |

The book's original audio files were **not** provided. Listening practice therefore uses platform-written dialogues read by TTS, and every such place is labelled as generated audio.

## Test results (2026-10-19)

- `npm test`: **15/15 pass**. Covers SRS bounds (this suite caught and fixed an interval-overflow bug), plan generation for 7/14/21/1 days, content integrity (192 pages, glossed Kelime items, assessment pages), and practice answer-key validity.
- `npm run e2e`: **16/16 pass** against both the dev and the production build. Covers:
  - all 192 reader pages and all 40 practice pages;
  - progress, notes and bookmarks;
  - word lookup with inflections;
  - SRS reviews and saved words;
  - the mistakes lifecycle;
  - exams, including an answer-key leak check and grading;
  - the full mock composition;
  - Focus Mode;
  - AI guard behaviour;
  - input validation;
  - accounts, including guest upgrade and progress following the account to a new device;
  - admin authorisation and overrides;
  - withheld page images.
- `next build`: passes. First-load JS is about 102–207 KB per route.
- Manual checks in the browser pane: home, reader, word popover and mobile reader layout.

## Real Gemini tests (2026-10-20, `npm run test:ai`)

Live API, no mocks. Last full run: 11 pass, 6 fail; the failures were free-tier quota exhaustion (guest quota of 15 and the daily model limits) and the transcriber mishearing very short single-word clips. Since then the test registers a member account and the transcription prompt was reworked; it has **not** been re-run after those changes because the daily quota was spent.

- Passed: TTS sentences (first 1.8–2.9 s, cached ~100 ms, exact round-trip transcription), Cyrillic rejected, page 35 explained in Kazakh with a page citation, «Dün ben okula gidiyorum» corrected to «gittim», admits missing information, structured writing feedback, Öğretmen correction + Kazakh explanation, Sohbet with no Kazakh / no corrections + end feedback.
- Browser pane (2026-10-20): Sohbet opened with a real reply and played Gemini audio; a typed answer with mistakes got a natural reply without correction; the end feedback listed «Kazakistanlıyım» and «öğrenciyim». Denied microphone switches to text input. Mobile layout 375 px: no horizontal scroll.
- Free tier on this key (measured): 20 requests/day per text model, 10/day per TTS model. ~72 test calls cost ≈ $0.05 at paid-tier prices. **Enable billing for real classroom use.**

## Not verified / blockers

1. **No human listening evaluation yet.** The Gemini voice was checked only by machine round-trip (TTS → transcription). Whether it sounds native to a Turkish speaker has not been judged by a person — do not claim native quality until it is.
2. **Real microphone not tested.** The test browser blocks microphone capture; voice turns were tested by sending recorded audio files to the same route. Test on real Android and iOS phones.
3. **Very short clips** (single words) are sometimes mis-transcribed; the prompt was improved but not re-measured.
4. **No official exam format or scoring criteria were provided.** Exams use clearly labelled practice rubrics, configurable in admin.
5. **Rights to the original page images and audio are unconfirmed.** Both are disabled until an admin enables them.
6. **The speaking exam is not graded acoustically.** This is stated in the UI.

## Next tasks

- Tune models and quotas against cost in `/admin?tab=ai`.
- Test on real Android and iOS devices, especially the microphone and TTS voices.
- Have a Turkish teacher review the 27 flagged pages and the practice bank, using the admin overrides.
- Re-run `npm run test:ai` when the daily quota resets (or after enabling billing).
- Have a Turkish speaker rate the Kore/Charon voices; try other Gemini voices via `GEMINI_TTS_VOICE_F/M` if needed.
- Optionally move to Postgres for multi-instance hosting.
- A2+ levels: add a `level` dimension to the content pipeline (units and pages are already data-driven).
