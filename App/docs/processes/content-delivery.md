# Content Delivery

**Summary:** Learning content (`content.json`, `sentences.json`) is fetched at
runtime from S3/CloudFront — not bundled into the JS. Same content for every
user.

## Flow

```
frontend/src/data/*.json  (source of truth)
        │ sync:content (pre-dev/pre-build)
        ▼
frontend/public/*.json ──vite build──► dist/*.json ──CloudFrontSite deploy──► S3
                                                                                │
                                                          browser fetch /content.json (same origin)
                                                                                ▼
                                                                        CloudFront serves it
```

## Steps

1. Source of truth: `frontend/src/data/content.json` + `sentences.json`.
2. `sync:content` npm script copies them to `frontend/public/` (auto-runs before
   `dev` and `build`).
3. `vite build` copies `public/` into `dist/`; `CloudFrontSite` uploads `dist/`
   to S3. The files are served at `/content.json`, `/sentences.json`.
4. At startup, `main.tsx` awaits `loadContent()` (in `lib/content.ts`) which
   `fetch`es both — a plain same-origin static fetch, no API/auth.
5. Local dev: Vite serves `public/`, so the same `/content.json` resolves offline.

## Why fetch instead of bundle

- Content can be updated (re-uploaded) without rebuilding the app.
- Keeps the JS bundle smaller.
- Same delivery mechanism as `config.json`.

## Rules

- The frontend renders only shapes it has code for. New content must fit the
  existing schema (see `backend/content-pipeline/`), or types + components must
  change first.
- Item `id`s are append-only (renaming/removing orphans SRS progress).

## Key files

- `frontend/src/lib/content.ts` — loader (`loadContent`/`getContent`/`getSentences`).
- `frontend/src/main.tsx` — awaits content before render.
- `backend/infra/lib/common/cloudfront-site.ts` — publishes `dist/` to S3.
