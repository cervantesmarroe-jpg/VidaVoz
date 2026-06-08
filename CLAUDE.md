# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

VidaVoz (aka VozUCI) is a Progressive Web App for assistive communication by ICU patients with reduced mobility — eye-tracking (gaze), touch, and sequential scanning let them signal needs to staff/family. UI strings, comments, and commit messages in this repo are predominantly in **Spanish**; match that convention when editing existing files.

A full architecture write-up (startup flow, eye-tracking pipeline, gaze profiles, TTS, storage) lives in `replit.md` — read it before making non-trivial changes to the gaze/cursor system.

## Commands

```bash
npm run dev       # start dev server (tsx server/index.ts, NODE_ENV=development) — serves client+API on :5000 via Vite middleware
npm run build     # script/build.ts — vite build (client) + esbuild bundle (server) → dist/
npm run start     # run production build: node dist/index.cjs
npm run check     # tsc type-check (noEmit)
npm run db:push   # drizzle-kit push — sync shared/schema.ts to Postgres (requires DATABASE_URL)
```

There is no test runner configured (`tsconfig.json` excludes `**/*.test.ts` but no test framework is installed).

The dev server requires `DATABASE_URL` (Postgres) to be set — `server/db.ts` and `drizzle.config.ts` both throw at import time if it's missing.

## Architecture

### Monorepo layout
- `client/` — React/Vite/TS frontend (root for Vite is `client/`, output `dist/public/`)
- `server/` — Express backend (`server/index.ts` entry, bundled to `dist/index.cjs` for prod)
- `shared/` — code imported by **both** client and server: `shared/schema.ts` (Drizzle table + Zod schema) and `shared/routes.ts` (the `api` object — single source of truth for REST paths, methods, input/response schemas, consumed by both `server/routes.ts` and `client/src/hooks/use-messages.ts`)
- Path aliases: `@` → `client/src`, `@shared` → `shared`, `@assets` → `attached_assets`

When changing an API contract, edit `shared/routes.ts` (and `shared/schema.ts` if the data shape changes) first — both server route handlers and the client query hooks key off it.

### Two completely separate frontends in one repo
1. **Production app** — everything under `client/src/pages`, `components`, `hooks`, mounted by `App.tsx` for any path *not* starting with `/wireframe`.
2. **Wireframe mode** (`client/src/wireframe/`) — a deliberately isolated low-fidelity prototype (TFM thesis annex) mounted whenever the URL starts with `/wireframe`. It bypasses splash/profile/query-providers/eye-tracking entirely (`App.tsx` short-circuits before any state is created) so it can never break or be affected by the production app. There's also a fully standalone export of it in `wireframe-export/` (its own `package.json`/`vite.config.ts`, not part of the main build).

### App startup flow (production app)
```
Splash (3s, silent gaze auto-calibration Phase 1)
  → ProfileSelect (user picks tablet/mobile gaze profile + QuickSync)
    → Router (FullscreenLayout + 4 tabs: Urgent / Messages / Scales / Keyboard)
      → WelcomePatient overlay (4s, only if eye-tracking active — Phase 1 auto-adjust continues)
```
`App.tsx` drives this with a simple `phase` state machine (`"splash" | "profile" | "ready"`).

### Eye-tracking system — the most complex subsystem
Centered on `client/src/hooks/use-webgazer.ts` (~1400 lines, heavily commented in Spanish — read the inline comments, they explain the *why* of each tunable constant):
- Engine: `@mediapipe/tasks-vision` `FaceLandmarker` (GPU delegate, VIDEO mode), loaded from CDN (WASM + model URL constants at top of the file)
- Pipeline: face blendshapes → linear regression (`alphaX/betaX`, `alphaY/betaY`) → screen coords → One-Euro filter + ring-buffer moving average → magnet snap to `[data-gaze-target="true"]` elements → dwell timer (`DWELL_MS`) fires `.click()`
- Also detects blinks (eye-open-ratio threshold + min/max duration window) as an alternate activation method
- `client/src/config/gazeProfiles.ts` defines factory regression "DNA" per device (`tablet`/`mobile`); `client/calibrations_library.json` is the actual library of calibration models the tracker selects from at runtime (the `model` fields in `gazeProfiles.ts` are historical reference only, no longer used as live coefficients)
- Two-phase silent auto-adjustment: Phase 1 (during Splash/WelcomePatient) corrects the per-session `alpha` offset from passive center samples; Phase 2 (during real use) nudges `alpha` by an EMA (`PHASE2_LEARNING_RATE`) on each successful low-error activation — neither phase ever mutates the factory profile
- `MasterTrainingOverlay.tsx` is an admin-only 9-point × 4-round calibration tool for computing new factory regression coefficients
- Global state: `useWebGazerStore` (zustand)

### Global cursor (`client/src/lib/globalCursor.ts`)
A single `#gaze-cursor` DOM element created **synchronously before React mounts** (imported as a side effect at the top of `main.tsx`, alongside `headOffsetCorrector.ts` and `touchSupportCursor.ts`). All native cursors are hidden app-wide. It arbitrates three input sources — mouse, touch (with a 500ms touch-lock to prevent gaze interference), and gaze — and renders dwell/blink visual feedback.

### Scanning mode
Non-camera accessibility fallback (`ScanningContext`): sequentially highlights every `[data-gaze-target="true"]` element on a fixed interval; activated when the user declines camera consent in `ConsentModal`.

### Other notable pieces
- `use-tts.ts` — Web Speech API wrapper; voice-selection priority favors Google Neural/Enhanced/Premium/Natural voices, locale preference `es-ES` > `es-US` > `es-MX`
- `use-messages.ts` — `@tanstack/react-query` hooks for `/api/messages`, typed against `shared/routes.ts`
- `server/storage.ts` — `IStorage` interface → `DatabaseStorage` (Drizzle/Postgres) implementation; this is the seam to swap storage backends
- PWA: `client/public/sw.js` + `manifest.json` for offline caching and fullscreen install

### Data model
Single `messages` table (`shared/schema.ts`): `id`, `text`, `category` (`'urgent' | 'messages' | ...`), `icon`, `isCustom`. Most on-screen messages are hardcoded in the frontend; the DB only stores user-added custom messages.

### Privacy
`ConsentModal` gates all camera access (GDPR-style, persisted via `localStorage` key `vozuci-consent-v1`). Gaze data never leaves the device — only regression coefficients are persisted, no biometric/video data.
