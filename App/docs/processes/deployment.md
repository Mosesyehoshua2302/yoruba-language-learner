# Deployment (CI/CD)

**Summary:** A gated GitHub Actions pipeline builds and deploys to AWS. Backend
deploys before frontend (frontend consumes backend outputs). Each deploy stage
needs manual approval.

## Flow

```
push to main / feature/content-management  (or manual dispatch)
        ▼
validate  (build frontend + cdk synth, no AWS, no deploy)
        ▼  [approval: production-backend]
deploy-backend   (cdk deploy YorubaYeMiBackend)
        ▼  [approval: production-frontend]
deploy-frontend  (npm run build → cdk deploy YorubaYeMiFrontend)
```

## Key points

- **Order matters:** the frontend stack consumes the backend's outputs (API URL,
  Cognito ids), so backend deploys first.
- **Auth to AWS:** OIDC — the jobs assume an IAM role via
  `secrets.OIDC_ROLE_ARN`; no stored AWS keys. See `github-oidc-aws.md`.
- **Region:** `vars.AWS_REGION`.
- **Approvals:** two GitHub Environments (`production-backend`,
  `production-frontend`) with required reviewers pause the run between stages.
- **`dist/` must exist at frontend deploy** — the job runs `npm run build` first
  so the `BucketDeployment` has files to upload (and writes `config.json`).

## Manual deploy (no CI)

```bash
cd App/frontend && npm run build
cd ../backend/infra && npx cdk deploy YorubaYeMiBackend   # first if not deployed
npx cdk deploy YorubaYeMiFrontend
```

## First-deploy gotcha (Cognito callback URL)

Hosted UI callback/logout URLs must match the CloudFront URL, which doesn't
exist until the first frontend deploy. So: deploy once, note the CloudFront URL,
set it in `dev.json` (`authCallbackUrls`/`authLogoutUrls`), redeploy backend +
frontend. Detail in `backend/infra/README.md`.

## Key files

- `.github/workflows/deploy.yml` — the pipeline.
- `backend/infra/bin/app.ts` — stack wiring + `dev.json`/`.env` loading.
