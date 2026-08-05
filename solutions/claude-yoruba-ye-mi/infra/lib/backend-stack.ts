import * as cdk from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import * as path from 'path';

export class BackendStack extends cdk.Stack {
  readonly apiUrl: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ------------------------------------------------------------------
    // Storage: one row per learner holding the full LearnerState blob.
    // The app state is small (well under DynamoDB's 400 KB item limit)
    // and always read/written whole, so a single-item model is the
    // simplest correct design.
    // ------------------------------------------------------------------
    const table = new dynamodb.Table(this, 'LearnerStateTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ------------------------------------------------------------------
    // Auth: Cognito user pool. Email sign-in, self-service sign-up.
    // ------------------------------------------------------------------
    const userPool = new cognito.UserPool(this, 'UserPool', {
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 10,
        requireLowercase: true,
        requireDigits: true,
        requireSymbols: false,
        requireUppercase: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const userPoolClient = userPool.addClient('SpaClient', {
      authFlows: { userSrp: true },
      preventUserExistenceErrors: true,
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
    });

    // ------------------------------------------------------------------
    // API: HTTP API with JWT auth; a single Lambda serves GET/PUT /state.
    // ------------------------------------------------------------------
    const stateFn = new NodejsFunction(this, 'StateFn', {
      entry: path.join(__dirname, '..', 'lambda', 'state-handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      environment: { TABLE_NAME: table.tableName },
      bundling: { minify: true, sourceMap: false },
    });
    table.grantReadWriteData(stateFn);

    const authorizer = new HttpJwtAuthorizer(
      'JwtAuthorizer',
      `https://cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}`,
      { jwtAudience: [userPoolClient.userPoolClientId] },
    );

    const api = new apigwv2.HttpApi(this, 'Api', {
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.PUT,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['Authorization', 'Content-Type'],
        maxAge: cdk.Duration.hours(1),
      },
      defaultAuthorizer: authorizer,
    });

    const integration = new HttpLambdaIntegration('StateIntegration', stateFn);
    api.addRoutes({ path: '/state', methods: [apigwv2.HttpMethod.GET], integration });
    api.addRoutes({ path: '/state', methods: [apigwv2.HttpMethod.PUT], integration });

    this.apiUrl = api.apiEndpoint;

    new cdk.CfnOutput(this, 'ApiUrl', { value: api.apiEndpoint });
    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, 'TableName', { value: table.tableName });
  }
}
