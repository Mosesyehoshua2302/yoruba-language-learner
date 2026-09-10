#!/usr/bin/env node
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import * as cdk from "aws-cdk-lib";
import { BackendStack } from "../lib/backend-stack";
import { FrontendStack } from "../lib/frontend-stack";

// Load infra/.env (holds GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET for synth).
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const app = new cdk.App();

// Load a context file (default: dev.json; override with CDK_CONTEXT_FILE).
// CDK's CLI has no --context-file flag, so we inject its `context` block into
// the app's context here. Precedence: values already set on the app (from
// cdk.json or -c flags) win, so an explicit -c can still override the file.
const contextFile = path.join(
  __dirname,
  "..",
  process.env.CDK_CONTEXT_FILE ?? "dev.json",
);
if (fs.existsSync(contextFile)) {
  const loaded = JSON.parse(fs.readFileSync(contextFile, "utf8")) as {
    context?: Record<string, unknown>;
  };
  for (const [key, value] of Object.entries(loaded.context ?? {})) {
    if (app.node.tryGetContext(key) === undefined) {
      app.node.setContext(key, value);
    }
  }
}

const backend = new BackendStack(app, "YorubaYeMiBackend", {
  description:
    "Yoruba Ye Mi — auth (Cognito), state-sync API (HTTP API + Lambda), storage (DynamoDB)",
});

new FrontendStack(app, "YorubaYeMiFrontend", {
  description: "Yoruba Ye Mi — static SPA hosting (S3 + CloudFront)",
  apiUrl: backend.apiUrl,
  userPoolId: backend.userPoolId,
  userPoolClientId: backend.userPoolClientId,
  cognitoDomain: backend.cognitoDomain,
});

app.synth();
