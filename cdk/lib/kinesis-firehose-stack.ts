import {
  Aws,
  Stack,
  Duration,
  CfnOutput,
  StackProps,
  aws_s3 as s3,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_dynamodb as dynamodb,
  aws_codecommit as codecommit,
  aws_apigateway as apigateway,
  aws_kinesisfirehose as kinesisfirehose,
} from 'aws-cdk-lib';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import * as path from 'path';

interface KinesisFirehoseStackProps extends StackProps {
  table: dynamodb.Table;
}
export class KinesisFirehoseStack extends Stack {

  constructor(scope: Construct, id:string, props:KinesisFirehoseStackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    const lambdaRepository = new codecommit.Repository(this, "ClicksProcessingLambdaRepository", {
      repositoryName: "MythicalMysfits-ClicksProcessingLambdaRepository"
    });
    
    const clicksDestinationBucket = new s3.Bucket(this, "Bucket", {
      versioned: true
    });
    
    const lambdaFunctionPolicy =  new iam.PolicyStatement();
    lambdaFunctionPolicy.addActions("dynamodb:GetItem");
    lambdaFunctionPolicy.addResources(props.table.tableArn);
    
    const mysfitsClicksProcessor = new NodejsFunction(this, "Function", {
      entry: path.join(__dirname, '../../app/streaming/streamProcessor.ts'),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_18_X,
      description: "An Amazon Kinesis Firehose stream processor that enriches click records" +
        " to not just include a mysfitId, but also other attributes that can be analyzed later.",
      memorySize: 128,
      timeout: Duration.seconds(30),
      initialPolicy: [
        lambdaFunctionPolicy
      ],
      environment: {
        MYSFITS_API_URL: "https://2euejd3x3b.execute-api.ap-south-1.amazonaws.com/prod" 
      },
      bundling: {
        tsconfig: path.join(__dirname, '../../app/tsconfig.json'),
        target: "node18"
      }
    });
    
    const firehoseDeliveryRole = new iam.Role(this, "FirehoseDeliveryRole", {
      roleName: "FirehoseDeliveryRole",
      assumedBy: new iam.ServicePrincipal("firehose.amazonaws.com"),
      externalIds: [Aws.ACCOUNT_ID]
    });

    const firehoseDeliveryPolicyS3Stm = new iam.PolicyStatement();
    firehoseDeliveryPolicyS3Stm.addActions("s3:AbortMultipartUpload",
          "s3:GetBucketLocation",
          "s3:GetObject",
          "s3:ListBucket",
          "s3:ListBucketMultipartUploads",
          "s3:PutObject");
    firehoseDeliveryPolicyS3Stm.addResources(clicksDestinationBucket.bucketArn);
    firehoseDeliveryPolicyS3Stm.addResources(clicksDestinationBucket.arnForObjects('*'));
    
    const firehoseDeliveryPolicyLambdaStm = new iam.PolicyStatement();
    firehoseDeliveryPolicyLambdaStm.addActions("lambda:InvokeFunction");
    firehoseDeliveryPolicyLambdaStm.addResources(mysfitsClicksProcessor.functionArn);
    
    firehoseDeliveryRole.addToPolicy(firehoseDeliveryPolicyS3Stm);
    firehoseDeliveryRole.addToPolicy(firehoseDeliveryPolicyLambdaStm);
    
    const mysfitsFireHoseToS3 = new kinesisfirehose.CfnDeliveryStream(this, "DeliveryStream", {
      extendedS3DestinationConfiguration: {
        bucketArn: clicksDestinationBucket.bucketArn,
        bufferingHints: {
          intervalInSeconds: 60,
          sizeInMBs: 50
        },
        compressionFormat: "UNCOMPRESSED",
        prefix: "firehose/",
        roleArn: firehoseDeliveryRole.roleArn,
        processingConfiguration: {
          enabled: true,
          processors: [
            {
              parameters: [
                {
                  parameterName: "LambdaArn",
                  parameterValue: mysfitsClicksProcessor.functionArn
                }
              ],
              type: "Lambda"
            }
          ]
        }
      }
    });
    
    new lambda.CfnPermission(this, "Permission", {
      action: "lambda:InvokeFunction",
      functionName: mysfitsClicksProcessor.functionArn,
      principal: "firehose.amazonaws.com",
      sourceAccount: Aws.ACCOUNT_ID,
      sourceArn: mysfitsFireHoseToS3.attrArn
    });
    
    const clickProcessingApiRole = new iam.Role(this, "ClickProcessingApiRole", {
      assumedBy: new iam.ServicePrincipal("apigateway.amazonaws.com")
    });
    
    const apiPolicy = new iam.PolicyStatement();
    apiPolicy.addActions("firehose:PutRecord");
    apiPolicy.addResources(mysfitsFireHoseToS3.attrArn);
    new iam.Policy(this, "ClickProcessingApiPolicy", {
      policyName: "api_gateway_firehose_proxy_role",
      statements: [
        apiPolicy
      ],
      roles: [clickProcessingApiRole]
    });
    
    const api = new apigateway.RestApi(this, "APIEndpoint", {
        restApiName: "ClickProcessing API Service",
        endpointTypes: [ apigateway.EndpointType.REGIONAL ]
    });
    
    const clicks = api.root.addResource('clicks');
    
    clicks.addMethod('PUT', new apigateway.AwsIntegration({
        service: 'firehose',
        integrationHttpMethod: 'POST',
        action: 'PutRecord',
        options: {
            connectionType: apigateway.ConnectionType.INTERNET,
            credentialsRole: clickProcessingApiRole,
            integrationResponses: [
              {
                statusCode: "200",
                responseTemplates: {
                  "application/json": '{"status":"OK"}'
                },
                responseParameters: {
                  "method.response.header.Access-Control-Allow-Headers": "'Content-Type'",
                  "method.response.header.Access-Control-Allow-Methods": "'OPTIONS,PUT'",
                  "method.response.header.Access-Control-Allow-Origin": "'*'"
                }
              }
            ],
            requestParameters: {
              "integration.request.header.Content-Type": "'application/x-amz-json-1.1'"
            },
            requestTemplates: {
              "application/json": `{ "DeliveryStreamName": "${mysfitsFireHoseToS3.ref}", "Record": { "Data": "$util.base64Encode($input.json('$'))" }}`
            }
        }
    }), {
        methodResponses: [
          {
            statusCode: "200",
            responseParameters: {
              "method.response.header.Access-Control-Allow-Headers": true,
              "method.response.header.Access-Control-Allow-Methods": true,
              "method.response.header.Access-Control-Allow-Origin": true
            }
          }
        ]
      }
    ); 
    
    clicks.addMethod("OPTIONS", new apigateway.MockIntegration({
      integrationResponses: [{
        statusCode: "200",
        responseParameters: {
          "method.response.header.Access-Control-Allow-Headers":
            "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
          "method.response.header.Access-Control-Allow-Origin": "'*'",
          "method.response.header.Access-Control-Allow-Credentials":
            "'false'",
          "method.response.header.Access-Control-Allow-Methods":
            "'OPTIONS,GET,PUT,POST,DELETE'"
        }
      }],
      passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
      requestTemplates: {
        "application/json": '{"statusCode": 200}'
      }
    }), {
        methodResponses: [
          {
            statusCode: "200",
            responseParameters: {
              "method.response.header.Access-Control-Allow-Headers": true,
              "method.response.header.Access-Control-Allow-Methods": true,
              "method.response.header.Access-Control-Allow-Credentials": true,
              "method.response.header.Access-Control-Allow-Origin": true
            }
          }
        ]
      }
    );
    
    new CfnOutput(this, "kinesisRepositoryCloneUrlHttp", {
      value: lambdaRepository.repositoryCloneUrlHttp,
      description: "Clicks Processing Lambda Repository Clone Url HTTP"
    });
    
    new CfnOutput(this, "kinesisRepositoryCloneUrlSsh", {
      value: lambdaRepository.repositoryCloneUrlSsh,
      description: "Clicks Processing Lambda Repository Clone Url SSH"
    });

  }
}
