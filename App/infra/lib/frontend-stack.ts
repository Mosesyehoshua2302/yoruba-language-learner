import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import * as path from 'path';
import * as fs from 'fs';

export interface FrontendStackProps extends cdk.StackProps {
  apiUrl: string;
}

export class FrontendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy:
          cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
      },
      defaultRootObject: 'index.html',
      // SPA: client-side routing (and direct deep links) fall back to index.html
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: cdk.Duration.minutes(5) },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: cdk.Duration.minutes(5) },
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      comment: 'Yoruba Ye Mi SPA',
    });

    // Deploy the built SPA if dist/ exists (run `npm run build` in the app root
    // first). Guarded so `cdk synth` works on a fresh checkout.
    const distDir = path.join(__dirname, '..', '..', 'dist');
    if (fs.existsSync(distDir)) {
      new s3deploy.BucketDeployment(this, 'DeploySite', {
        sources: [
          s3deploy.Source.asset(distDir),
          // Runtime config the SPA can fetch without rebuilding per-environment.
          s3deploy.Source.jsonData('config.json', { apiUrl: props.apiUrl }),
        ],
        destinationBucket: siteBucket,
        distribution,
        distributionPaths: ['/*'],
      });
    }

    new cdk.CfnOutput(this, 'SiteUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'CloudFront URL of the deployed app',
    });
    new cdk.CfnOutput(this, 'SiteBucketName', { value: siteBucket.bucketName });
  }
}
