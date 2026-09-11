---
name: document-processes
description: Capture non-obvious app processes (auth flows, data storage, deployment, integrations, etc.) as short, clear docs under App/docs/processes/. Use when a process is designed, explained, or changed.
---

# Document Processes

Keep a living, plain-language record of how key parts of this app work, so
knowledge isn't lost in chat history or buried in code.

## When to use

Whenever a non-obvious process is designed, explained in depth, or changed —
e.g. auth/API access, how a component stores data, a deployment flow, an
external integration, a security mechanism. If you just explained "how X works"
in a way worth keeping, document it.

## Where

`App/docs/processes/` — one `.md` per process. Update the index in
`App/docs/processes/README.md`.

## Format (keep it tight, not wordy)

Each doc has:
1. **Summary** — one or two sentences: what it is.
2. **Flow** — a simple ASCII diagram of the path.
3. **Steps** — numbered, plain language.
4. **Why it's shaped this way** — the key design reasons.
5. **Key files** — the files that implement it.

Optional: a "gotchas" or "debugging" section when the process has sharp edges.

## Rules

- Plain language over jargon; explain acronyms once.
- Short. Prefer a diagram + bullets over paragraphs.
- Accurate to the current code — reference real file paths.
- When a documented process changes, update its doc in the same change.
- Add every new doc to the README index.
