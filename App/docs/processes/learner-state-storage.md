# Learner State Storage

**Summary:** DynamoDB is the cloud save-file for each user. One row per user,
holding their whole learning progress as a JSON blob, keyed by Cognito `sub`, so
progress syncs across devices.

## What's stored

```
{
  userId:    "<cognito sub>",        # partition key: which user
  state:     { ...LearnerState... }, # the whole progress blob
  updatedAt: "2026-...Z"             # last write (last-write-wins conflicts)
}
```

`state` is the `LearnerState` from `types.ts`: SRS card schedule (ease, interval,
due date, history), chapter status (locked/active/passed/demoted), quiz history,
study streak, and gamification (XP, badges).

## How it syncs (via store.tsx)

- **Load/sign-in:** `api.fetchState()` → `GET /state` → Lambda reads the user's
  row → store hydrates (`storage.reconcile(serverState, content)`).
- **On change** (grade a card, pass a chapter, earn XP): reducer updates the
  in-memory state → debounced effect calls `api.saveState(state)` → `PUT /state`
  → Lambda writes the blob back to the user's row.

localStorage is the instant local cache; DynamoDB is the durable, cross-device
mirror.

## Why one blob, one row

- State is small (<380 KB, enforced) and always read/written whole.
- No cross-user queries or partial updates needed.
- So a single key-value item per user is the simplest correct design — no joins,
  no migrations, no partial-write conflicts.

## What DynamoDB does NOT store

- **Learning content** (vocab/grammar) → S3/CloudFront (`content.json`), same for all users.
- **Accounts/credentials** → Cognito. DynamoDB only holds the `sub` reference.
- **App config** → `config.json` in S3.

## Key files

- `frontend/src/state/store.tsx` — in-memory state + sync effects.
- `frontend/src/lib/storage.ts` — local cache + reconcile.
- `backend/infra/lambda/state_handler.py` — reads/writes the row.
