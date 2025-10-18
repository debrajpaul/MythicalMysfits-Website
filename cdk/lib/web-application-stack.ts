import path = require('path');
import {
  Stack,
  aws_iam as iam,
  aws_s3 as s3,
  aws_cloudfront as cloudfront,
  aws_s3_deployment as s3deploy
} from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class WebApplicationStack extends Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    // The code that defines your stack goes here
    const webAppRoot = path.resolve(__dirname, '..', '..', 'web');
    const bucket = new s3.Bucket(this, "Bucket", {
      websiteIndexDocument: "index.html"
    });
    // Obtain the cloudfront origin access identity so that the s3 bucket may be restricted to it.
    const origin = new cloudfront.OriginAccessIdentity(this, "BucketOrigin", {
        comment: "mythical-mysfits"
    });

    // Restrict the S3 bucket via a bucket policy that only allows our CloudFront distribution
    bucket.grantRead(new iam.CanonicalUserPrincipal(
      origin.cloudFrontOriginAccessIdentityS3CanonicalUserId
    ));

    const cdn = new cloudfront.CloudFrontWebDistribution(this, "CloudFront", {
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.ALLOW_ALL,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
      originConfigs: [
        {
          behaviors: [
            {
              isDefaultBehavior: true,
              maxTtl: undefined,
              allowedMethods:
                cloudfront.CloudFrontAllowedMethods.GET_HEAD_OPTIONS
            }
          ],
          s3OriginSource: {
            s3BucketSource: bucket,
            originAccessIdentity: origin,
            originPath: "/web"
          }
        }
      ]
    });

    new s3deploy.BucketDeployment(this, "DeployWebsite", {
      sources: [
        s3deploy.Source.asset(webAppRoot)
      ],
      destinationKeyPrefix: "web/",
      destinationBucket: bucket,
      distribution: cdn,
      retainOnDelete: false
    });

    new cdk.CfnOutput(this, "CloudFrontURL", {
      description: "The CloudFront distribution URL",
      value: "https://" + cdn.distributionDomainName
    });
  }
}