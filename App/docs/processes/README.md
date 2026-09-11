# Process Docs

Short, plain-language explanations of how key parts of the app work. One process
per file. Read these to understand a flow without digging through code.

## Index

- [Authentication & API access](./auth-and-api-access.md) — how a signed-in user reaches the backend.
- [Learner state storage](./learner-state-storage.md) — what DynamoDB stores and how it syncs.
- [Content delivery](./content-delivery.md) — how learning content reaches the frontend.
- [Deployment (CI/CD)](./deployment.md) — how the app ships to AWS.
- [GitHub OIDC → AWS](./github-oidc-aws.md) — how CI authenticates to AWS without stored keys.

## Convention

When a non-obvious process is designed or explained, capture it here as a new
`*.md` (add it to the index above). Keep each doc: a one-line summary, a simple
diagram, the steps, and "why it's shaped this way." Avoid wordiness.
