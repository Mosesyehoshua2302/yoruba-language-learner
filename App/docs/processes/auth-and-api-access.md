# Authentication & API Access

**Summary:** The app never calls Lambda directly. A signed-in user carries a
Cognito JWT, sends it to API Gateway, which validates it and then invokes the
Lambda. The user holds only a login token — no AWS credentials.

## Flow

```
browser (api.ts) ──HTTPS + Bearer token──► API Gateway (HTTP API)
                                               │ JWT authorizer validates token
                                               ▼
                                           Lambda (state_handler.py)
                                               │ IAM execution role
                                               ▼
                                           DynamoDB
```

## Steps

1. **Where** — the app reads `apiUrl` from `config.json` (fetched at startup) and
   calls `${apiUrl}/state`. That endpoint is API Gateway (public HTTPS).
2. **Who** — `api.ts` attaches `Authorization: Bearer <idToken>`. The token is a
   Cognito-issued, signed JWT the user got by signing in (Hosted UI, `auth.ts`).
3. **Enforcement** — API Gateway's Cognito JWT authorizer verifies the token's
   signature, expiry, and audience against the user pool. Invalid → 401, request
   never reaches Lambda.
4. **Gateway → Lambda** — AWS resource permission (wired by the `HttpLambdaApi`
   construct) lets API Gateway invoke the function.
5. **Lambda → DynamoDB** — the Lambda's IAM execution role
   (`table.grantReadWriteData(fn)`) allows read/write. It uses the token's `sub`
   as the `userId` key, so a user only ever touches their own row.

## Access is granted at three hops (not one)

| Hop | What grants access |
|---|---|
| Browser → API Gateway | Cognito JWT (user signed in) |
| API Gateway → Lambda | AWS resource permission (CDK-wired) |
| Lambda → DynamoDB | Lambda IAM execution role |

## Why it's shaped this way

- Token validated **before** Lambda runs → unauthenticated calls can't reach data.
- `userId` derived from the verified token, never from client input → a user
  can't read/write someone else's data.
- No AWS keys in the browser — only a short-lived login token.

## Key files

- `frontend/src/lib/api.ts` — attaches the token, calls the endpoint.
- `frontend/src/lib/auth.ts` — obtains/refreshes the Cognito token.
- `backend/infra/lambda/state_handler.py` — the handler; reads `sub`.
- `backend/infra/lib/backend-stack.ts` — API + authorizer + Lambda + grants.
