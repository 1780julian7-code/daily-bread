# Daily Bread — Bible Companion

A Bible study app: daily reading plans, AI devotionals, an AI Bible helper, theology topics and courses,
Bible people and places, trivia, guided study plans, Christian videos, journal, themes and gestures.

## How it runs
- `public/` — the app (one page), icons, install manifest and offline support.
- `netlify/functions/ai.mts` — the AI endpoint at `/api/ai`. It uses **Netlify AI Gateway**, so no
  Anthropic key is needed; usage is billed to the Netlify team's credits.
- Progress, notes and settings are saved on each device (browser storage).

## Settings (Netlify → Project configuration → Environment variables)
- `APP_CODE` (optional) — if set, the app asks for this code once per device before it can use AI.
  Not set right now, so anyone can use the app. AI requests are rate-limited to 30 per minute per visitor.

## Deploys
Every push to `main` deploys automatically once this repo is linked to the Netlify project.
