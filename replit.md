# VidaVoz — Assistive Communication App for ICU Patients

## Overview

VidaVoz is a Progressive Web App (PWA) designed for assistive communication in ICU (intensive care unit) environments. It enables patients with reduced mobility or inability to speak to communicate with medical staff and family through eye-tracking (gaze control), touch, and sequential scanning.

The app provides four main communication interfaces:
- **Urgent** — large emergency buttons (pain, breathlessness, nausea, thirst)
- **Messages** — common needs grid (family, bathroom, temperature, etc.)
- **Scales** — EVA pain scale, Borg dyspnea scale, and anxiety scale
- **Keyboard** — QWERTY text input with Text-to-Speech output

Eye tracking is powered by **MediaPipe FaceLandmarker** (not WebGazer.js despite initial requirements). Gaze calibration uses a linear regression model with per-device factory profiles and a two-phase silent auto-adjustment system. The app is usable without eye tracking via sequential scanning mode (no camera required).

The backend is a minimal Express server that stores custom user messages in a PostgreSQL database via Drizzle ORM.

---

## User Preferences

Preferred communication style: Simple, everyday language.

---

## System Architecture

### Frontend Architecture

- **Framework**: React (Vite, TypeScript, TSX)
- **Routing**: `wouter` (lightweight client-side routing)
- **State Management**:
  - `zustand` for eye-tracker global state (`useWebGazerStore`)
  - React Context for scanning mode (`ScanningContext`)
  - `@tanstack/react-query` for server data (messages)
- **UI Library**: shadcn/ui components (Radix UI primitives + Tailwind CSS)
- **Styling**: Tailwind CSS with CSS variables for theming; custom `Lexend` font; warm cream/pastel color palette optimized for ICU visibility
- **PWA**: Service worker (`sw.js`) with offline caching for main routes; Web App Manifest with fullscreen display

### App Startup Flow

```
Splash (3s, silent gaze calibration) 
  → ProfileSelect (tablet / mobile gaze profile)
    → Main App (FullscreenLayout + tabs)
      → WelcomePatient (4s, if eye-tracking active, Phase 1 auto-adjust)
```

### Eye-Tracking System (`use-webgazer.ts`)

- **Engine**: `@mediapipe/tasks-vision` FaceLandmarker with GPU delegate, run in VIDEO mode
- **Gaze computation**: Uses face blendshapes (`eyeLookInLeft`, `eyeLookOutLeft`, `eyeLookUpLeft`, `eyeLookDownLeft`) → linear regression model (alpha + beta × eyeValue) → screen coordinates
- **Smoothing**: One-Euro filter + ring-buffer moving average (30 samples); snap-to-button magnet within 58px; 10px dead zone
- **Dwell activation**: 3000ms dwell on any `[data-gaze-target="true"]` element → fires `click()`
- **Blink detection**: Eye-open ratio threshold; 200–500ms blink window; 1200ms refractory period
- **Gaze profiles** (`gazeProfiles.ts`): Factory regression coefficients for `tablet` and `mobile` profiles; selected at startup via `ProfileSelect`
- **Auto-adjustment (Phase 1)**: During Splash/WelcomePatient screens, silent center samples correct `alphaX/alphaY` offset for that session only — never modifies factory profile
- **Auto-adjustment (Phase 2)**: Each successful activation nudges `alpha` by `LEARNING_RATE=0.25` if error < 80px
- **Master Training Mode** (`MasterTrainingOverlay`): Admin-only 9-point × 4-round calibration to compute new factory regression coefficients

### Global Cursor (`globalCursor.ts`)

- Single `#gaze-cursor` DOM element (fixed, `z-index: 99999`, pointer-events: none)
- Created synchronously before React mounts (imported in `main.tsx`)
- All native cursors hidden via `cursor: none !important` on all elements
- Three input sources: mouse, touch (500ms touch-lock prevents gaze interference), gaze
- Visual feedback: green flash on blink success, dwell ring animation on buttons

### Scanning Mode (`ScanningContext`)

- Sequential highlight cycling (2000ms interval) over all `[data-gaze-target="true"]` elements
- Activated when user declines camera consent — provides non-camera accessibility fallback

### Text-to-Speech (`use-tts.ts`)

- Web Speech API (`SpeechSynthesis`) — no external package
- Voice selection priority: Google Neural > Enhanced > Premium > Natural > Spanish fallback
- Locale preference: `es-ES` > `es-US` > `es-MX`

### Backend Architecture

- **Runtime**: Node.js with Express (`server/index.ts`)
- **API**: REST endpoints under `/api/messages` (list, create, delete)
- **Route definitions**: Shared between client and server via `shared/routes.ts` with Zod schemas
- **Storage interface**: `IStorage` abstraction in `server/storage.ts` → `DatabaseStorage` implementation

### Data Storage

- **Database**: PostgreSQL via `drizzle-orm/node-postgres`
- **Schema** (`shared/schema.ts`): Single `messages` table with `id`, `text`, `category`, `icon`, `isCustom` fields
- **Migrations**: Drizzle Kit (`drizzle.config.ts`), output to `./migrations/`
- **Connection**: Pool via `DATABASE_URL` environment variable

### Security & Privacy

- `ConsentModal` gates camera access — GDPR-style consent before any camera use
- Gaze data never leaves the device; only regression coefficients stored (no biometric data)
- Camera fallback: scanning mode available without camera

---

## External Dependencies

### Core Libraries

| Dependency | Purpose |
|---|---|
| `@mediapipe/tasks-vision` (v0.10.32) | Face landmark detection and blendshapes for eye-tracking |
| `@tanstack/react-query` (v5) | Server state management and API caching |
| `zustand` | Lightweight global state for gaze tracker |
| `wouter` | Client-side routing |
| `drizzle-orm` + `drizzle-zod` | ORM and schema validation |
| `zod` | Runtime type validation for API input/output |

### UI Components

| Dependency | Purpose |
|---|---|
| Radix UI (full suite) | Accessible primitive components |
| `tailwind-merge` + `clsx` | Conditional class merging |
| `class-variance-authority` | Component variant management |
| `lucide-react` | Icon set |
| shadcn/ui (New York style) | Pre-built component patterns |

### External CDN Resources (loaded at runtime)

- **MediaPipe WASM**: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm`
- **FaceLandmarker model**: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`
- **Google Fonts**: `Lexend` font family (preconnected in `index.html`)
- **MediaPipe camera utils + face mesh**: Legacy CDN scripts in `index.html` (for `eyetracking.html` standalone tool)

### Infrastructure

| Service | Purpose |
|---|---|
| PostgreSQL | Persistent storage for custom user messages |
| `connect-pg-simple` | Session store (available but session auth not fully implemented) |
| Replit Vite plugins | Dev banner, cartographer, runtime error modal (dev only) |

### Build Tools

- **Vite** — frontend bundler with HMR
- **esbuild** — server bundler (via `script/build.ts`)
- **tsx** — TypeScript execution for dev server
- **PostCSS** + **autoprefixer** — CSS processing

### Browser APIs Used

- `Web Speech API` (SpeechSynthesis) — Text-to-Speech, no package needed
- `MediaDevices.getUserMedia` — Camera access for eye-tracking
- `Service Worker API` — PWA offline support
- `requestAnimationFrame` — Gaze render loop and dwell animations
- `localStorage` — Consent flag (`vozuci-consent-v1`), gaze weights persistence