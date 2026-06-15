# PracticalPodcast

A sign-in-gated news-podcast web app. Each morning it sources the day's top stories across
16 topics (finance, science, technology, geopolitics, politics, and more) and generates
**three AI-hosted podcasts** that summarize the day — a **10-minute "Quick Brief"**, a
**30-minute "Daily Deep Dive"**, and a **60-minute "Full Story"** — each co-hosted by a female
AI voice (**Nova**) and a male AI voice (**Atlas**).

> **Status:** Implemented. A Node + TypeScript + Express + Prisma/SQLite backend serves the
> (formerly static) mockups in `mockups/` and powers them via a vanilla-JS `fetch` layer:
> passwordless email sign-in, topic onboarding, an episode library, a real audio player,
> a discover/sources page, and account settings. A daily generation pipeline (NewsAPI →
> Claude → ElevenLabs → assembled MP3 → email digest) runs on demand.

## Architecture

| Layer | Tech |
|------|------|
| Backend | Node.js + Express 5 + TypeScript |
| Database | SQLite via Prisma 6 |
| Frontend | the existing `mockups/` HTML/CSS, wired with vanilla JS (`mockups/api.js` + `mockups/pages/*.js`) — no framework |
| AI scripts | Anthropic Claude (`claude-opus-4-8`) — streaming, adaptive thinking, prompt caching, structured output |
| News | NewsAPI.org |
| Text-to-speech | ElevenLabs (one voice per host) |
| Email | Gmail SMTP via Nodemailer (OTP codes + daily digest) — no domain needed |
| Audio assembly | ffmpeg/ffprobe (bundled binaries — no manual install) |

The Express server also serves `mockups/` as the frontend, so the whole app runs from one
process at `http://localhost:3000`.

## Quick start (works with zero external API keys)

The app is fully usable on **seeded sample data** before you wire any provider — sign-in
codes print to the server console, and a placeholder audio clip plays in the real player.

```bash
cd server
npm install
copy .env.example .env        # (Windows)  — or: cp .env.example .env
npm run migrate               # create the SQLite DB
npm run seed:sample           # 16 topics + sample episodes + placeholder audio
npm run dev                   # http://localhost:3000
```

Then open **http://localhost:3000**:

1. Click **Sign in**, enter any email, **Send verification code**.
2. The 6-digit code is printed in the server console as `[DEV OTP] you@example.com -> 123456`.
   (`DEV_LOG_OTP=true` in `.env` controls this.)
3. Enter the code → pick at least 3 topics → land in your library.
4. Play an episode (scrub, change speed, read the transcript/chapters/sources), browse
   **Discover**, and change **Settings**.

## Running the real generation pipeline

To generate real episodes, add provider keys to `server/.env`:

```
ANTHROPIC_API_KEY=...           # Claude — script generation
NEWSAPI_KEY=...                 # NewsAPI.org — news sourcing
ELEVENLABS_API_KEY=...          # ElevenLabs — text-to-speech
ELEVENLABS_VOICE_NOVA=...       # a female voice id
ELEVENLABS_VOICE_ATLAS=...      # a male voice id
```

Email (OTP codes + digest) is **optional** and sent via **Gmail SMTP** — no domain
needed. Set `GMAIL_USER` and a Google **App Password** (`GMAIL_APP_PASSWORD`) in
`.env`; without them, codes fall back to the server console.

Then run it once (idempotent per day — it won't regenerate if today's three episodes exist):

```bash
npm run pipeline                # generate for today (app timezone)
npm run pipeline -- 2026-06-13  # or a specific date
```

Cost/latency knobs in `.env` while testing: `DEV_ONLY_SHORT=true` (only the 10-min episode),
`DEV_MAX_TTS_LINES=20` (cap synthesized lines per episode).

> To run automatically each morning, wrap `runPipeline()` in `node-cron`
> (`"0 6 * * *"`, timezone `APP_TZ`) — see the note at the bottom of
> `server/src/pipeline/runPipeline.ts`.

## Project layout

```
mockups/                  # frontend (served statically)
  api.js                  # fetch wrapper + auth guard + helpers
  pages/*.js              # per-page glue (signin, verify, onboarding, library, player, topics, account)
  *.html, styles.css, app.js   # the original mockups (app.js hooks reused, not replaced)
server/
  src/
    app.ts index.ts       # Express app + entry
    config/env.ts         # zod-validated env (web vs pipeline)
    routes/ controllers/ services/   # REST API (Prisma only in services/)
    providers/            # newsapi, anthropic, elevenlabs, audio, email adapters
    pipeline/             # runPipeline + prompts (system + JSON schema)
    middleware/ lib/ db/
  prisma/schema.prisma    # data model
  scripts/                # seed, sample seed, runPipelineNow, e2e (Playwright smoke test)
  storage/audio/          # generated episode MP3s (served via /api/audio/:id)
```

## NPM scripts (`server/`)

| Script | What |
|--------|------|
| `npm run dev` | dev server with hot reload (tsx watch) |
| `npm run build` / `npm start` | compile to `dist/` / run compiled server |
| `npm run migrate` | apply Prisma migrations |
| `npm run seed` / `npm run seed:sample` | seed topics / topics + sample episodes |
| `npm run pipeline` | run the daily generation pipeline now |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run e2e` | Playwright browser smoke test (needs the dev server running + `SERVER_LOG` env) |

## API surface (all under `/api`, same-origin session cookie)

`POST /auth/request-code` · `POST /auth/verify-code` · `POST /auth/logout` · `GET /me` ·
`GET /topics` · `PUT /me/topics` · `PUT /me/settings` · `GET /episodes` (`?length&topic&q`) ·
`GET /episodes/:id` · `PUT /episodes/:id/playback` · `GET /discover` (`?date&topic`) ·
`GET /audio/:episodeId` (HTTP Range streaming).

## Design system

- **Style:** sleek, dark-first audio app with a violet accent; bold gradient cover art per topic.
- **Theming:** CSS custom properties with `[data-theme="dark"|"light"]`; the toggle persists in
  `localStorage` and is mirrored to the user's saved preference on sign-in.
- **Accessibility:** semantic landmarks, labelled controls, visible focus rings, AA-contrast
  palettes in both themes, keyboard-operable tabs/OTP/filters, `prefers-reduced-motion` guard.
