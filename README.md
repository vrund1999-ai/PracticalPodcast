# PracticalPodcast

A sign-in-gated podcast website. Each day it sources the top news stories across many topics
(finance, science, technology, transportation, politics, geopolitics, and more) and generates
**three AI-hosted podcasts** that summarize the day — a **10-minute**, a **30-minute**, and a
**1-hour** episode — each hosted by a male and a female AI voice.

> **Status:** UI design phase. This repo currently contains static, clickable **mockups** of
> every screen. No backend, authentication, news pipeline, or audio generation yet.

## Viewing the mockups

Open **`mockups/index.html`** in any browser — there's no build step or dependencies.

```bash
# from the repo root, either just open the file:
open mockups/index.html          # macOS
xdg-open mockups/index.html      # Linux

# …or serve the folder (recommended, avoids any file:// quirks):
python3 -m http.server -d mockups 8000
# then visit http://localhost:8000
```

The gallery page links to every screen. Use the **sun/moon button** (top-right of every page)
to switch light/dark — your choice persists across pages and respects your OS setting on first
load.

## Flows / screens

| File | Flow | Notes |
|------|------|-------|
| `index.html` | Mockup gallery | Entry point linking every screen |
| `signin.html` | Sign in | Email-only; sends a 6-digit code |
| `verify.html` | 2FA verification | 6-box OTP, auto-advance, paste, resend timer, error variant |
| `onboarding.html` | First-run topic picker | Selectable topic chips |
| `library.html` | **Podcast library (home)** | Episodes grouped by date; 10m/30m/1h per day; **length filter** + search |
| `player.html` | Episode player | Male/female hosts, scrubber, show notes, transcript, chapters |
| `topics.html` | Discover / today's news | Sourced articles grouped by topic |
| `account.html` | Account & settings | Profile, topics, theme, playback, notifications, sign out |

## Design system

- **Style:** sleek, dark-first audio app with a violet accent; bold gradient cover art per topic.
- **Theming:** CSS custom properties with `[data-theme="dark"|"light"]`; toggle persisted in
  `localStorage`, defaults to `prefers-color-scheme`.
- **Accessibility:** semantic landmarks, labelled controls, visible focus rings, AA-contrast
  palettes in both themes, keyboard-operable tabs/OTP/filters, `prefers-reduced-motion` guard.
- **Shared files:** `mockups/styles.css` (tokens + components), `mockups/app.js` (theme toggle,
  OTP behavior, length filter, chip/tab interactivity, mock play/pause).

## Not yet built (future phases)

Real email + one-time-code authentication, the daily news-sourcing pipeline, AI script
generation, text-to-speech voice synthesis for the two hosts, audio hosting/streaming, and the
backend/database. The mockups define the visual direction these will be built against.
