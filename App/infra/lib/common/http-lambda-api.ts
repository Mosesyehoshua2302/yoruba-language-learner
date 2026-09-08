import * as cdk from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

/** A single route bound to the API's Lambda integration. */
export interface HttpRoute {
  readonly path: string;
  readonly methods: apigwv2.HttpMethod[];
}

/** Cognito JWT authorizer config. Omit to leave the API unauthenticated. */
export interface JwtAuthConfig {
  readonly userPool: cognito.IUserPool;
  readonly userPoolClient: cognito.IUserPoolClient;
}

/**
 * Props for {@link HttpLambdaApi}.
 *
 * The construct composes an HTTP API, an optional JWT authorizer, one Lambda,
 * and a set of routes — a bundle the CDK L2s do not provide on their own, and
 * the real reuse target. Everything the caller is likely to vary is a prop:
 *
 * - `function` — full `lambda.FunctionProps`, merged over house defaults.
 * - `routes` — the caller declares its own paths/methods (no hardcoded routes).
 * - `jwtAuth` — supply to require Cognito JWTs; omit for a public API.
 * - `cors` — full `apigwv2.CorsPreflightOptions`, merged over house defaults.
 */
export interface HttpLambdaApiProps {
  /** Lambda configuration; `code`, `handler`, `runtime` are required by CDK. */
  readonly function: lambda.FunctionProps;
  /** Routes to bind to the Lambda integration. */
  readonly routes: HttpRoute[];
  /** Optional Cognito JWT authorizer; omit to leave the API public. */
  readonly jwtAuth?: JwtAuthConfig;
  /** CORS preflight overrides, merged over the house defaults. */
  readonly cors?: apigwv2.CorsPreflightOptions;
}

/**
 * HTTP API (API Gateway v2) fronting a single Lambda across one or more routes,
 * optionally secured by a Cognito JWT authorizer.
 *
 * Compound, resource-oriented construct: it knows nothing about `/state` or any
 * specific handler — the consuming stack injects the function, routes, auth and
 * CORS. Defaults exist only for CORS and generic Lambda sizing.
 */
export class HttpLambdaApi extends Construct {
  static readonly FUNCTION_DEFAULTS = {
    architecture: lambda.Architecture.ARM_64,
    memorySize: 256,
    timeout: cdk.Duration.seconds(10),
  } satisfies Partial<lambda.FunctionProps>;

  static readonly CORS_DEFAULTS: apigwv2.CorsPreflightOptions = {
    allowOrigins: ['*'],
    allowMethods: [
      apigwv2.CorsHttpMethod.GET,
      apigwv2.CorsHttpMethod.PUT,
      apigwv2.CorsHttpMethod.OPTIONS,
    ],
    allowHeaders: ['Authorization', 'Content-Type'],
    maxAge: cdk.Duration.hours(1),
  };

  readonly api: apigwv2.HttpApi;
  readonly handlerFn: lambda.Function;

  constructor(scope: Construct, id: string, props: HttpLambdaApiProps) {
    super(scope, id);

    this.handlerFn = new lambda.Function(this, 'Fn', {
      ...HttpLambdaApi.FUNCTION_DEFAULTS,
      ...props.function,
    });

    const defaultAuthorizer = props.jwtAuth
      ? new HttpJwtAuthorizer(
          'JwtAuthorizer',
          `https://cognito-idp.${cdk.Stack.of(this).region}.amazonaws.com/${props.jwtAuth.userPool.userPoolId}`,
          { jwtAudience: [props.jwtAuth.userPoolClient.userPoolClientId] },
        )
      : undefined;

    this.api = new apigwv2.HttpApi(this, 'Api', {
      corsPreflight: { ...HttpLambdaApi.CORS_DEFAULTS, ...props.cors },
      defaultAuthorizer,
    });

    const integration = new HttpLambdaIntegration('Integration', this.handlerFn);
    for (const route of props.routes) {
      this.api.addRoutes({ path: route.path, methods: route.methods, integration });
    }
  }

  /** Base endpoint URL of the HTTP API. */
  get apiUrl(): string {
    return this.api.apiEndpoint;
  }
}
