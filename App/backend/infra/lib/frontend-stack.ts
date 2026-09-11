import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";
import { CloudFrontSite } from "./common";

export interface FrontendStackProps extends cdk.StackProps {
  apiUrl: string;
  userPoolId: string;
  userPoolClientId: string;
  /** Base Hosted UI URL, e.g. https://<prefix>.auth.<region>.amazoncognito.com */
  cognitoDomain: string;
}

export class FrontendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    // The OIDC client needs the same redirect/logout URIs the Cognito app
    // client is configured with. These come from the same manual context
    // values the backend stack reads (localhost defaults for dev).
    const redirectUri = firstUrl(
      this.node.tryGetContext("authCallbackUrls"),
      "http://localhost:5173/callback",
    );
    const logoutUri = firstUrl(
      this.node.tryGetContext("authLogoutUrls"),
      "http://localhost:5173/",
    );

    const site = new CloudFrontSite(this, "Site", {
      // Deploy the built SPA if dist/ exists (run `npm run build` in App/frontend
      // first). Guarded so `cdk synth` works on a fresh checkout.
      // Path: lib -> infra -> backend -> App -> frontend/dist
      distDir: path.join(__dirname, "..", "..", "..", "frontend", "dist"),
      // Runtime config fetched by the SPA at startup — keeps the build
      // environment-agnostic (no rebuild per environment).
      runtimeConfig: {
        apiUrl: props.apiUrl,
        region: cdk.Stack.of(this).region,
        userPoolId: props.userPoolId,
        userPoolClientId: props.userPoolClientId,
        cognitoDomain: props.cognitoDomain,
        redirectUri,
        logoutUri,
      },
      distribution: { comment: "Yoruba Ye Mi SPA" },
    });

    new cdk.CfnOutput(this, "SiteUrl", {
      value: site.siteUrl,
      description: "CloudFront URL of the deployed app",
    });
    new cdk.CfnOutput(this, "SiteBucketName", {
      value: site.bucket.bucketName,
    });
  }
}

/** First URL from a comma-separated string or JSON array, else the fallback. */
function firstUrl(raw: unknown, fallback: string): string {
  if (Array.isArray(raw) && raw.length > 0) return String(raw[0]);
  if (typeof raw === "string" && raw.trim() !== "") {
    const first = raw.split(",")[0]?.trim();
    if (first) return first;
  }
  return fallback;
}
