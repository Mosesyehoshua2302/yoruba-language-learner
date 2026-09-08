import * as cdk from "aws-cdk-lib";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import * as path from "path";
import { DynamoDbTable, CognitoUserPool, HttpLambdaApi } from "./common";

export class BackendStack extends cdk.Stack {
  readonly apiUrl: string;
  readonly userPoolId: string;
  readonly userPoolClientId: string;
  /** Base Hosted UI URL, e.g. https://<prefix>.auth.<region>.amazoncognito.com */
  readonly cognitoDomain: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Storage: one row per learner holding the full LearnerState blob. The
    // use-case decision (partition key = userId) lives here, not in the
    // construct.
    const storage = new DynamoDbTable(this, "LearnerState", {
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
    });

    // Auth: Cognito user pool + app client. Hosted UI (OAuth2 authorization
    // code + PKCE) is a use-case decision, so its config is injected here, not
    // baked into the construct.
    //
    // Callback/logout URLs are supplied manually as context values (per the
    // spec's locked-in decision): default to localhost for dev; after the first
    // frontend deploy, set them to the CloudFront URL and redeploy this stack.
    //   npx cdk deploy YorubaYeMiBackend \
    //     -c authCallbackUrls=https://<cloudfront>/callback \
    //     -c authLogoutUrls=https://<cloudfront>/
    const callbackUrls = parseUrlList(
      this.node.tryGetContext("authCallbackUrls"),
      ["http://localhost:5173/callback"],
    );
    const logoutUrls = parseUrlList(this.node.tryGetContext("authLogoutUrls"), [
      "http://localhost:5173/",
    ]);

    const auth = new CognitoUserPool(this, "Auth", {
      client: {
        // Hosted UI uses the OAuth authorization-code grant (with PKCE for a
        // public SPA client — no client secret). SRP is not needed here.
        authFlows: { userSrp: false },
        preventUserExistenceErrors: true,
        accessTokenValidity: cdk.Duration.hours(1),
        idTokenValidity: cdk.Duration.hours(1),
        refreshTokenValidity: cdk.Duration.days(30),
        oAuth: {
          flows: { authorizationCodeGrant: true },
          scopes: [
            cognito.OAuthScope.OPENID,
            cognito.OAuthScope.EMAIL,
            cognito.OAuthScope.PROFILE,
          ],
          callbackUrls,
          logoutUrls,
        },
      },
    });

    // Hosted UI needs a domain. A Cognito-prefix domain is used for now; the
    // prefix can be overridden via context and must be globally unique.
    const domainPrefix =
      (this.node.tryGetContext("cognitoDomainPrefix") as string | undefined) ??
      `yoruba-ye-mi-${cdk.Stack.of(this).account}`;
    auth.userPool.addDomain("HostedUiDomain", {
      cognitoDomain: { domainPrefix },
    });

    // API: HTTP API with JWT auth; a single Python Lambda serves GET/PUT /state.
    const stateApi = new HttpLambdaApi(this, "State", {
      function: {
        code: lambda.Code.fromAsset(path.join(__dirname, "..", "lambda")),
        handler: "state_handler.handler",
        runtime: lambda.Runtime.PYTHON_3_13,
        environment: { TABLE_NAME: storage.tableName },
      },
      routes: [
        { path: "/state", methods: [apigwv2.HttpMethod.GET] },
        { path: "/state", methods: [apigwv2.HttpMethod.PUT] },
      ],
      jwtAuth: {
        userPool: auth.userPool,
        userPoolClient: auth.userPoolClient,
      },
    });
    storage.table.grantReadWriteData(stateApi.handlerFn);

    this.apiUrl = stateApi.apiUrl;
    this.userPoolId = auth.userPoolId;
    this.userPoolClientId = auth.userPoolClientId;
    this.cognitoDomain = `https://${domainPrefix}.auth.${cdk.Stack.of(this).region}.amazoncognito.com`;

    new cdk.CfnOutput(this, "ApiUrl", { value: stateApi.apiUrl });
    new cdk.CfnOutput(this, "UserPoolId", { value: auth.userPoolId });
    new cdk.CfnOutput(this, "UserPoolClientId", {
      value: auth.userPoolClientId,
    });
    new cdk.CfnOutput(this, "UserPoolDomain", { value: this.cognitoDomain });
    new cdk.CfnOutput(this, "TableName", { value: storage.tableName });
  }
}

/**
 * Parse a context value into a URL list. Accepts a comma-separated string
 * (from `-c key=a,b`) or a JSON array, falling back to the provided default.
 */
function parseUrlList(raw: unknown, fallback: string[]): string[] {
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === "string" && raw.trim() !== "") {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return fallback;
}
