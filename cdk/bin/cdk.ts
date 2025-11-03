#!/usr/bin/env node
import 'source-map-support/register';
import { App } from 'aws-cdk-lib';
import { WebApplicationStack } from "../lib/web-application-stack";
import { NetworkStack } from "../lib/network-stack";
import { EcrStack } from "../lib/ecr-stack";
import { EcsStack } from "../lib/ecs-stack";
import { CiCdStack } from "../lib/cicd-stack";
import { DynamoDbStack } from "../lib/dynamodb-stack";
import { CognitoStack } from "../lib/cognito-stack";
import { APIGatewayStack } from "../lib/apigateway-stack";

const env = {
  region: 'ap-south-1',
};

// 1 deploy
const app = new App();
new WebApplicationStack(app, "MythicalMysfits-Website-Showcase",{env});
const networkStack = new NetworkStack(app, "MythicalMysfits-Network", {env});
const ecrStack = new EcrStack(app, "MythicalMysfits-ECR", {env});
// need to excute it
// aws ecr get-login-password | docker login --username AWS --password-stdin $(aws sts get-caller-identity --query Account --output text).dkr.ecr.$(aws configure get region).amazonaws.com
// docker build --platform linux/amd64 . -t $(aws sts get-caller-identity --query Account --output text).dkr.ecr.$(aws configure get region).amazonaws.com/mythicalmysfits/service:latest
// docker push $(aws sts get-caller-identity --query Account --output text).dkr.ecr.$(aws configure get region).amazonaws.com/mythicalmysfits/service:latest
// 2 deploy 
const ecsStack = new EcsStack(app, "MythicalMysfits-ECS", {
    env,
    vpc: networkStack.vpc,
    ecrRepository: ecrStack.ecrRepository
});
// need create secrets manager
/* aws secretsmanager create-secret \
  --name github-token-secret-name \
  --secret-string <your-github-pat>
*/
new CiCdStack(app, "MythicalMysfits-CICD", {
    env,
    githubOwner:"debrajpaul",
    githubRepo:"MythicalMysfits-Website",
    githubTokenSecretName: "github-token-secret",
    ecrRepository: ecrStack.ecrRepository,
    ecsService: ecsStack.ecsService.service
});
const dynamoDbStack = new DynamoDbStack(app, "MythicalMysfits-DynamoDB", {
    env,
    vpc: networkStack.vpc,
    fargateService: ecsStack.ecsService.service
});
// go back to root then run it
// aws dynamodb batch-write-item --request-items file://data/populate-dynamodb.json
// aws dynamodb scan --table-name MysfitsTable
const cognito = new CognitoStack(app,  "MythicalMysfits-Cognito", { env });
new APIGatewayStack(app, "MythicalMysfits-APIGateway", {
  env,
  userPoolId: cognito.userPool.userPoolId,
  loadBalancerArn: ecsStack.ecsService.loadBalancer.loadBalancerArn,
  loadBalancerDnsName: ecsStack.ecsService.loadBalancer.loadBalancerDnsName
});
