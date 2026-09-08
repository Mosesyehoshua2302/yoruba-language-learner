import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import * as fs from 'fs';

/**
 * Props for {@link CloudFrontSite}.
 *
 * Compound construct: an S3 origin bucket, a CloudFront distribution with
 * origin access control, and an optional asset deployment. The pieces callers
 * commonly vary are exposed as overrides merged over house defaults:
 *
 * - `bucket` — `s3.BucketProps` overrides (defaults: private, SSL-only, SSE).
 * - `distribution` — `cloudfront.DistributionProps` overrides (defaults: HTTPS
 *   redirect, security headers, SPA fallback to index.html, PriceClass_100).
 * - `distDir` / `runtimeConfig` — the use-case specifics for what to deploy.
 */
export interface CloudFrontSiteProps {
  /**
   * Directory holding built assets to deploy. Deployment is skipped when the
   * directory does not exist, so `cdk synth` works on a fresh checkout.
   */
  readonly distDir?: string;

  /**
   * Runtime config written to `config.json` in the bucket and fetched by the
   * app at runtime (avoids rebuilding per environment).
   */
  readonly runtimeConfig?: { [key: string]: unknown };

  /** Overrides merged over the bucket defaults. */
  readonly bucket?: s3.BucketProps;

  /**
   * Overrides merged over the distribution defaults. `defaultBehavior` is
   * merged field-wise so callers can tweak (e.g.) the cache policy without
   * having to re-specify the S3 origin.
   */
  readonly distribution?: Partial<cloudfront.DistributionProps>;
}

/**
 * An S3-hosted static site fronted by CloudFront, with defaults-with-override
 * configuration. Resource-oriented: it does not assume it is serving any
 * particular app — the caller injects the assets and any runtime config.
 */
export class CloudFrontSite extends Construct {
  static readonly BUCKET_DEFAULTS = {
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    encryption: s3.BucketEncryption.S3_MANAGED,
    enforceSSL: true,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
    autoDeleteObjects: true,
  } satisfies s3.BucketProps;

  readonly bucket: s3.Bucket;
  readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: CloudFrontSiteProps = {}) {
    super(scope, id);

    this.bucket = new s3.Bucket(this, 'Bucket', {
      ...CloudFrontSite.BUCKET_DEFAULTS,
      ...props.bucket,
    });

    const distributionDefaults: cloudfront.DistributionProps = {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
      },
      defaultRootObject: 'index.html',
      // SPA: client-side routing (and deep links) fall back to index.html.
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: cdk.Duration.minutes(5) },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: cdk.Duration.minutes(5) },
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    };

    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      ...distributionDefaults,
      ...props.distribution,
      // Merge defaultBehavior field-wise so callers keep the S3 origin unless
      // they explicitly replace it.
      defaultBehavior: {
        ...distributionDefaults.defaultBehavior,
        ...props.distribution?.defaultBehavior,
      },
    });

    if (props.distDir && fs.existsSync(props.distDir)) {
      const sources = [s3deploy.Source.asset(props.distDir)];
      if (props.runtimeConfig) {
        sources.push(s3deploy.Source.jsonData('config.json', props.runtimeConfig));
      }

      new s3deploy.BucketDeployment(this, 'Deploy', {
        sources,
        destinationBucket: this.bucket,
        distribution: this.distribution,
        distributionPaths: ['/*'],
      });
    }
  }

  /** Public HTTPS URL of the distribution. */
  get siteUrl(): string {
    return `https://${this.distribution.distributionDomainName}`;
  }
}
