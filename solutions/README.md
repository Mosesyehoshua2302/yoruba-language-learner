# Yorùbá app — solutions

Reference implementations kept for comparison.

## claude-yoruba-ye-mi/

Claude's solution: a modern, gamified web app built from the *Yorùbá Yé Mi*
open textbook (COERLL / UT Austin, CC-licensed).

- **Stack**: React 18 + TypeScript + Tailwind + Vite, no other runtime deps.
- **Learning engine**: SM-2 spaced repetition per item, 12 sequential chapter
  gates (pass ≥ 80%, demotion if rolling accuracy < 60%), daily review queue.
- **Gamification**: XP + levels, streaks, 14 badges, celebration toasts —
  additive only, never gates content.
- **Design**: warm ink/forest/gold palette, serif display type, light/dark
  mode, 3D flip-cards, SVG icons (no emoji).
- **Persistence**: localStorage, versioned, with in-place migration.
- **infra/**: TypeScript CDK for AWS hosting — S3+CloudFront frontend;
  Cognito + HTTP API + Lambda + DynamoDB state-sync backend (not yet wired
  to the frontend). See `claude-yoruba-ye-mi/infra/README.md`.

Run it:

```bash
cd claude-yoruba-ye-mi && npm install && npm run dev
```

Tests: `npm test` · Build: `npm run build`

`node_modules/`, `dist/`, and `cdk.out/` were excluded from the copy —
`npm install` in the app root (and in `infra/` if deploying) restores them.
