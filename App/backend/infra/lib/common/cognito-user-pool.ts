import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import { Construct } from "constructs";

/**
 * Props for {@link CognitoUserPool}.
 *
 * `userPool` accepts the full CDK `cognito.UserPoolProps`; `client` accepts the
 * full `cognito.UserPoolClientOptions`. Both are merged over house defaults
 * (see {@link CognitoUserPool.USER_POOL_DEFAULTS} /
 * {@link CognitoUserPool.CLIENT_DEFAULTS}), so any component can reshape sign-in
 * behaviour, password policy, token validity, etc. while still inheriting safe
 * defaults for anything it does not set.
 */
export interface CognitoUserPoolProps {
  /** Overrides merged over the user-pool defaults. */
  readonly userPool?: cognito.UserPoolProps;
  /** Overrides merged over the app-client defaults. */
  readonly client?: cognito.UserPoolClientOptions;
}

/**
 * A Cognito user pool plus a single app client, with defaults-with-override
 * configuration.
 *
 * Resource-level, not use-case specific: the defaults describe a generic
 * browser-app sign-in (email alias, self sign-up, SRP client) but every field
 * is overridable by the consuming stack.
 */
export class CognitoUserPool extends Construct {
  static readonly USER_POOL_DEFAULTS = {
    // Invite-only by default: users are created by an admin, not self-service.
    // A consuming stack can override this via `props.userPool.selfSignUpEnabled`.
    selfSignUpEnabled: false,
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
  } satisfies cognito.UserPoolProps;

  static readonly CLIENT_DEFAULTS = {
    authFlows: { userSrp: true },
    preventUserExistenceErrors: true,
    accessTokenValidity: cdk.Duration.hours(1),
    idTokenValidity: cdk.Duration.hours(1),
    refreshTokenValidity: cdk.Duration.days(30),
  } satisfies cognito.UserPoolClientOptions;

  readonly userPool: cognito.UserPool;
  readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: CognitoUserPoolProps = {}) {
    super(scope, id);

    this.userPool = new cognito.UserPool(this, "Resource", {
      ...CognitoUserPool.USER_POOL_DEFAULTS,
      ...props.userPool,
    });

    this.userPoolClient = this.userPool.addClient("Client", {
      ...CognitoUserPool.CLIENT_DEFAULTS,
      ...props.client,
    });
  }

  get userPoolId(): string {
    return this.userPool.userPoolId;
  }

  get userPoolClientId(): string {
    return this.userPoolClient.userPoolClientId;
  }
}
