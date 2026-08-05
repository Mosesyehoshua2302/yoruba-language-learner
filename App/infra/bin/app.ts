#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { BackendStack } from '../lib/backend-stack';
import { FrontendStack } from '../lib/frontend-stack';

const app = new cdk.App();

const backend = new BackendStack(app, 'YorubaYeMiBackend', {
  description: 'Yoruba Ye Mi — auth (Cognito), state-sync API (HTTP API + Lambda), storage (DynamoDB)',
});

new FrontendStack(app, 'YorubaYeMiFrontend', {
  description: 'Yoruba Ye Mi — static SPA hosting (S3 + CloudFront)',
  apiUrl: backend.apiUrl,
});

app.synth();
