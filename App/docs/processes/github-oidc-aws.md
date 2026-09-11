# GitHub OIDC → AWS

**Summary:** CI authenticates to AWS with a short-lived OIDC token instead of
stored access keys. GitHub mints a signed JWT; AWS assumes an IAM role if the
token's claims match the role's trust policy.

## Flow

```
GitHub Actions job (permissions: id-token: write)
        │ mints a signed JWT (sub = which repo/env, aud = sts.amazonaws.com)
        ▼
aws-actions/configure-aws-credentials → sts:AssumeRoleWithWebIdentity
        │ AWS checks: token signed by trusted provider? aud + sub match trust policy?
        ▼
temporary AWS credentials (no stored keys)
```

## JWT claims that matter

- **`sub` (subject)** — *who* the token is about: the repo + context, e.g.
  `repo:<owner>/<repo>:environment:production-backend`. Checked against the trust
  policy's `sub` condition.
- **`aud` (audience)** — *who it's for*: `sts.amazonaws.com`. Ensures the token
  was minted for AWS.

## Gotcha: immutable subject claims

If the repo has **immutable subject claims** enabled, the `sub` includes numeric
ids, e.g.:

```
repo:Owner@54636309/repo@1324050168:environment:production-backend
```

The trust policy must use this exact id-based prefix — the plain `owner/repo`
form will NOT match, and you get:
`Not authorized to perform sts:AssumeRoleWithWebIdentity`.

Find the exact prefix in GitHub → repo Settings → the OIDC "subject claim"
display. Ids are immutable (survive renames).

## Trust policy shape

```json
{
  "Effect": "Allow",
  "Principal": { "Federated": "arn:aws:iam::<acct>:oidc-provider/token.actions.githubusercontent.com" },
  "Action": "sts:AssumeRoleWithWebIdentity",
  "Condition": {
    "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
    "StringLike":   { "token.actions.githubusercontent.com:sub": "repo:<exact-prefix>:*" }
  }
}
```

Prefer listing exact subs (branches + environments) over `:*` for tighter scope.

## Debugging "Not authorized"

1. Confirm the IAM OIDC provider exists in the account.
2. `aws iam get-role --role-name <role> --query Role.AssumeRolePolicyDocument` —
   check the live trust policy.
3. Compare its `sub` string against the repo's actual subject prefix (mind the
   immutable-id format and case sensitivity).
4. `aud` must be `sts.amazonaws.com`; job needs `permissions: id-token: write`.

## Wired in

- `.github/workflows/deploy.yml` — `role-to-assume: ${{ secrets.OIDC_ROLE_ARN }}`.
