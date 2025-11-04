import {
  Stack,
  Duration,
  CfnOutput,
  StackProps,
  aws_sns as sns,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_dynamodb as dynamodb,
  aws_codecommit as codecommit,
  aws_sns_subscriptions as subs,
  aws_apigateway as apigateway,
  aws_lambda_event_sources as lambdaEvent,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class XRayStack extends Stack {

  constructor(scope: Construct, id:string, props:StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    const lambdaRepository = new codecommit.Repository(this, "QuestionsLambdaRepository", {
      repositoryName: "MythicalMysfits-QuestionsLambdaRepository"
    });

    const table = new dynamodb.Table(this, "Table", {
      tableName: "MysfitsQuestionsTable",
      partitionKey: {
        name: "QuestionId",
        type: dynamodb.AttributeType.STRING
      },
      stream: dynamodb.StreamViewType.NEW_IMAGE
    });

    const postQuestionLambdaFunctionPolicyStmDDB =  new iam.PolicyStatement();
    postQuestionLambdaFunctionPolicyStmDDB.addActions("dynamodb:PutItem");
    postQuestionLambdaFunctionPolicyStmDDB.addResources(table.tableArn);

    const LambdaFunctionPolicyStmXRay =  new iam.PolicyStatement();
    LambdaFunctionPolicyStmXRay.addActions(
          //  Allows the Lambda function to interact with X-Ray
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords",
          "xray:GetSamplingRules",
          "xray:GetSamplingTargets",
          "xray:GetSamplingStatisticSummaries"
        );
    LambdaFunctionPolicyStmXRay.addAllResources();

    const mysfitsPostQuestion = new lambda.Function(this, "PostQuestionFunction", {
      handler: "mysfitsPostQuestion.postQuestion",
      runtime: lambda.Runtime.PYTHON_3_6,
      description: "A microservice Lambda function that receives a new question submitted to the MythicalMysfits" +
                      " website from a user and inserts it into a DynamoDB database table.",
      memorySize: 128,
      code: lambda.Code.fromAsset("../../lambda-questions/PostQuestionsService"),
      timeout: Duration.seconds(30),
      initialPolicy: [
        postQuestionLambdaFunctionPolicyStmDDB,
        LambdaFunctionPolicyStmXRay
      ],
      tracing: lambda.Tracing.ACTIVE
    });

    const topic = new sns.Topic(this, 'Topic', {
        displayName: 'MythicalMysfitsQuestionsTopic',
        topicName: 'MythicalMysfitsQuestionsTopic'
    });
    topic.addSubscription(new subs.EmailSubscription("REPLACE@EMAIL_ADDRESS"));

    const postQuestionLambdaFunctionPolicyStmSNS =  new iam.PolicyStatement();
    postQuestionLambdaFunctionPolicyStmSNS.addActions("sns:Publish");
    postQuestionLambdaFunctionPolicyStmSNS.addResources(topic.topicArn);

    const mysfitsProcessQuestionStream = new lambda.Function(this, "ProcessQuestionStreamFunction", {
      handler: "mysfitsProcessStream.processStream",
      runtime: lambda.Runtime.PYTHON_3_6,
      description: "An AWS Lambda function that will process all new questions posted to mythical mysfits" +
                      " and notify the site administrator of the question that was asked.",
      memorySize: 128,
      code: lambda.Code.fromAsset("../../lambda-questions/ProcessQuestionsStream"),
      timeout: Duration.seconds(30),
      initialPolicy: [
        postQuestionLambdaFunctionPolicyStmSNS,
        LambdaFunctionPolicyStmXRay
      ],
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        SNS_TOPIC_ARN: topic.topicArn
      },
      events: [
        new lambdaEvent.DynamoEventSource(table, {
            startingPosition: lambda.StartingPosition.TRIM_HORIZON,
            batchSize: 1
        })
      ]
    });

    const questionsApiRole = new iam.Role(this, "QuestionsApiRole", {
      assumedBy: new iam.ServicePrincipal("apigateway.amazonaws.com")
    });

    const apiPolicy = new iam.PolicyStatement();
    apiPolicy.addActions("lambda:InvokeFunction");
    apiPolicy.addResources(mysfitsPostQuestion.functionArn);
    new iam.Policy(this, "QuestionsApiPolicy", {
      policyName: "questions_api_policy",
      statements: [
        apiPolicy
      ],
      roles: [questionsApiRole]
    });

    const questionsIntegration = new apigateway.LambdaIntegration(
      mysfitsPostQuestion,
      {
        credentialsRole: questionsApiRole,
        integrationResponses: [
          {
            statusCode: "200",
            responseTemplates: {
              "application/json": '{"status":"OK"}'
            }
          }
        ]
      }
    );

    const api = new apigateway.LambdaRestApi(this, "APIEndpoint", {
      handler: mysfitsPostQuestion,
      restApiName: "Questions API Service",
      deployOptions:{tracingEnabled:true},
      proxy: false
    });

    const questionsMethod = api.root.addResource("questions");
    questionsMethod.addMethod("POST", questionsIntegration, {
      methodResponses: [{
        statusCode: "200",
        responseParameters: {
          'method.response.header.Access-Control-Allow-Headers': true,
          'method.response.header.Access-Control-Allow-Methods': true,
          'method.response.header.Access-Control-Allow-Origin': true,
        },
      }],
      authorizationType: apigateway.AuthorizationType.NONE
    });

    questionsMethod.addMethod('OPTIONS', new apigateway.MockIntegration({
      integrationResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
          'method.response.header.Access-Control-Allow-Origin': "'*'",
          'method.response.header.Access-Control-Allow-Credentials': "'false'",
          'method.response.header.Access-Control-Allow-Methods': "'OPTIONS,GET,PUT,POST,DELETE'",
        },
      }],
      passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
      requestTemplates: {
        "application/json": "{\"statusCode\": 200}"
      },
    }), {
      methodResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Headers': true,
          'method.response.header.Access-Control-Allow-Methods': true,
          'method.response.header.Access-Control-Allow-Credentials': true,
          'method.response.header.Access-Control-Allow-Origin': true,
        },
      }]
    });

    new CfnOutput(this, "questionsRepositoryCloneUrlHttp", {
      value: lambdaRepository.repositoryCloneUrlHttp,
      description: "Questions Lambda Repository Clone Url HTTP"
    });

    new CfnOutput(this, "questionsRepositoryCloneUrlSsh", {
      value: lambdaRepository.repositoryCloneUrlSsh,
      description: "Questions Lambda Repository Clone Url SSH"
    });
  }
}