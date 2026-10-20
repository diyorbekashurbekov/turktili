# Yedi İklim A1

A Turkish A1 learning platform for Kazakh-speaking students, built around the *Yedi İklim Türkçe A1* textbook: an interactive 192-page reader, Kelime Dünyası vocabulary, four-skill practice, exams, Focus Mode, accounts, an admin panel, and an AI teacher on Google Gemini.

Project page: https://diyorbekashurbekov.github.io/turktili/ (a description only; GitHub Pages cannot run the platform's server).

## Run locally

```bash
npm install
cp .env.example .env.local   # then set GEMINI_API_KEY
npm run dev                  # http://localhost:3100
```

Requires Node ≥ 22.13. Architecture, test results and deployment notes (Railway) are in [PROJECT.md](PROJECT.md).
