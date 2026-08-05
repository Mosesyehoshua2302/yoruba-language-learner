# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A local-first web app for learning Yorùbá, built entirely from the open textbook *Yorùbá Yé Mi*
(Fẹ̀hìntọ́lá Mosádomi, COERLL / UT Austin, 2012, CC-licensed). All content — 12 chapters, 1,008
vocabulary items, 47 grammar lessons — lives in `App/src/data/content.json`, extracted from the
PDF in `Documents/`.

## Repo layout

- `App/` — the live app (React 18 + TypeScript + Tailwind + Vite). Work here.
- `App/infra/` — optional AWS CDK stack for hosting (see below).
- `solutions/claude-yoruba-ye-mi/` — a frozen reference copy of `App/`, kept only for comparison.
  It is currently identical to `App/`. Do not edit it as part of normal feature work; it exists
  as a snapshot, not a second live target.
- `Documents/yoruba.pdf` — the source textbook that `App/scripts/` extracted content from.

## Commands (run from `App/`)

```bash
npm install
npm run dev      # frontend dev server only
npm run server   # local Express+Postgres state server only
npm run dev:full # both together (frontend proxies /api to the server)
npm run db:setup # one-time: create the local `yoruba_learner` DB + table
npm run build    # tsc && vite build -> dist/
npm run preview  # preview a production build
npm test         # vitest run (SRS + gate unit tests)
```

Run a single test file: `npx vitest run src/lib/__tests__/srs.test.ts`. Tests also run
standalone via `tsx` if needed. Requires Node 18+ and, for the state server, a local Postgres
instance (credentials in `App/server/.env`, gitignored — see `App/server/.env.example`).

There is no lint script configured; `tsc` (via `npm run build`) is the type-check gate — note
its `include` is scoped to `src/`, so it does not type-check `App/server/`.

The app works fully offline: `src/lib/storage.ts` keeps a `localStorage` cache for instant loads.
The source of truth for learner state is Postgres via `App/server/` (a small Express API,
`GET/PUT /api/state`) — the frontend syncs to it in the background (`src/lib/api.ts`, wired into
`src/state/store.tsx`) and falls back to the localStorage cache when the server is unreachable.
This is a separate, local-only backend from the AWS one in `App/infra/` (see below).

## Architecture: two progression layers, one source of truth

**Layer A — chapter gates (macro), `src/lib/gate.ts`.** The book's 12 chapters are sequential
levels, each with an assessment (~12 mixed questions: MC Yorùbá→English/English→Yorùbá, typed
translation, grammar comprehension). Passing at `PASS_THRESHOLD` (80%) unlocks the next chapter.
Failing keeps the learner on the chapter, records missed items, and the retake draws a fresh
weighted sample (missed items and lapsed SRS cards weighted up — never the same quiz verbatim).

**Layer B — spaced repetition (micro), `src/lib/srs.ts`.** Every vocab/grammar item is an SM-2
card: ease factor, interval, repetition count, due date. Review grades (Again/Hard/Good/Easy →
SM-2 quality 1/3/4/5) update the schedule; a failed card resets its interval (standard SM-2 lapse)
and resurfaces within the session. The daily queue (`src/lib/queue.ts`) mixes due cards from all
unlocked chapters with up to `newPerDay` (default 10) new items/day from the current chapter.

**How they interact.** Chapter assessments draw questions from the chapter's SRS cards, and every
assessment answer is *also* recorded as an SRS review of that card — there is no separate quiz
bank. Each card keeps a rolling window of its last 20 results; if a *passed* chapter's rolling
accuracy drops below `DEMOTE_THRESHOLD` (60%, minimum `MIN_SAMPLES` = 10 recent reviews), the
chapter is demoted: it reopens as active practice, its cards jump to the front of the queue, and
all forward progress is blocked until it's re-passed. The demotion sweep (`sweepDemotions`) runs
after every graded review, dispatched from the reducer in `src/state/store.tsx`.

Because both thresholds (`PASS_THRESHOLD`, `DEMOTE_THRESHOLD`, `MIN_SAMPLES`) live as named
constants in `gate.ts`, changing progression difficulty means editing that one file — logic and
UI never hardcode these numbers separately.

## Code layout (`App/src/`)

```
data/content.json    all book content (single source of truth for vocab/grammar)
lib/srs.ts           SM-2 scheduler (pure functions)
lib/gate.ts          chapter gates, pass/fail, demotion sweep
lib/queue.ts         daily review-queue builder
lib/quiz.ts          assessment/drill question generation
lib/gamification.ts  XP/levels/streaks/badges — additive only, never gates content
lib/storage.ts       localStorage cache (versioned, with migration) + reconcile() vs content
lib/api.ts           fetch/save client for the local state server (App/server/)
lib/__tests__/       vitest unit tests for srs.ts and gate.ts
state/store.tsx       React context + reducer wiring the lib modules to the UI, server sync
components/          Dashboard, Syllabus, Lesson, Review, Assessment, Intro, Sentences
components/ui/       ProgressRing, Celebrations (toasts), ThemeToggle, icons
```

Logic modules under `lib/` are UI-free and independently testable; the UI (`components/`) only
dispatches actions through `state/store.tsx` and reads derived state. When changing gate/SRS
behavior, prefer editing `lib/*.ts` and its test in `lib/__tests__/` over touching components.

`state/store.tsx` holds a single `useReducer` with actions `grade-card`, `introduce`,
`assessment`, `sweep-demotions`, `reset`, `hydrate`. Every action funnels through
`storage.save` (localStorage) on commit; once the initial server fetch resolves (a `hydrated`
ref gates this so the pre-fetch snapshot never overwrites server data), state changes are also
debounced (~600ms) into `api.saveState` against the Postgres-backed server. Badge unlocks and
level-ups are emitted as transient `CelebrationEvent`s via a pub/sub (`subscribeCelebrations`)
from a `useEffect` (not from inside the reducer) specifically so StrictMode's double-invocation
of reducers can't double-fire celebration toasts — keep that pattern if you add new celebration
triggers.

## Editing content

Content is data, not code — fix extraction errors or add items directly in
`App/src/data/content.json` (and mirror in `App/content.json` / `solutions/.../content.json` if
those need to stay in sync — check whether they're supposed to before assuming so):

- Vocab: `{"id":"c3-v12","type":"vocab","pos":"noun","yo":"ọjà","en":"market"}` — edit
  `yo`/`en`/`pos` freely; **keep `id` stable** so learner progress (SRS card) stays attached.
- Grammar: edit `explanation` or the `examples` array (`{"yo":…,"en":…}`).
- New items: use a fresh unique `id` (e.g. `c3-v99`) — the app creates an SRS card for it
  automatically on next load without disturbing existing progress.

To re-run extraction from the PDF: `scripts/extract_content.py` (two-column parsing with
pdfplumber) → `scripts/build_content.py` (assembles `content.json`). `scripts/decode.py` holds
the legacy "YorubaSans" font's empirically-derived character map (the PDF has no Unicode mapping
for ọ/ẹ/ṣ/tone marks — see `content.json → meta.extractionNotes` for the full notes and known
extraction caveats before treating a garbled string as a new bug).

Typed-answer questions accept tone-markless input (e.g. `e kaaaro` for `Ẹ káàárọ̀`) since typing
Yorùbá diacritics on a standard keyboard is impractical; multiple-choice still requires full
orthography.

## Local state server (`App/server/`)

Express + `pg`, single fixed-row table `learner_state(id, state jsonb, updated_at)` — mirrors
the whole `LearnerState` blob, matching the single-item design of the DynamoDB backend below.
`GET/PUT /api/state`, same contract (`{ state, updatedAt }` / `{ state }` → `{ updatedAt }`,
380KB cap) as `App/infra/lambda/state-handler.ts`, so the two backends stay interchangeable in
shape even though one is local/Postgres and the other is AWS/DynamoDB. The frontend
(`src/lib/api.ts`) calls it directly at `http://localhost:8787` — not via a Vite dev-server
proxy, which turned out to be unreliable in this environment (Vite 5's proxy never opened an
outbound connection at all, no error, just hung — root cause not pinned down, possibly a
Vite/Node-version interaction). The server sends permissive CORS headers instead, so the direct
call works the same in dev, `vite preview`, and prod regardless. `server/setup-db.ts` creates
the `yoruba_learner` database and applies `server/schema.sql` — run via `npm run db:setup`.

## Infra (`App/infra/`, optional AWS deployment)

TypeScript CDK, not deployed/wired by default, and unrelated to the local Postgres server above.
Two stacks: `YorubaYeMiFrontend` (S3 + CloudFront static hosting) and `YorubaYeMiBackend`
(Cognito + HTTP API + Lambda + DynamoDB for cross-device state sync — **not yet called by the
frontend**). Deploy with `cdk deploy --all` from `infra/` after `npm run build` in `App/`.
Details in `App/infra/README.md`, including the roadmap for wiring the frontend to it.
