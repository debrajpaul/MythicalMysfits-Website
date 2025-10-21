#!/usr/bin/env node
import 'source-map-support/register';
import { App } from 'aws-cdk-lib';
import { WebApplicationStack } from "../lib/web-application-stack";
import { NetworkStack } from "../lib/network-stack";
import { EcrStack } from "../lib/ecr-stack";
import { EcsStack } from "../lib/ecs-stack";
import { CiCdStack } from "../lib/cicd-stack";

const env = {
  region: 'ap-south-1',
};

// 1 deploy
const app = new App();
new WebApplicationStack(app, "MythicalMysfits-Website-Showcase",{env});
const networkStack = new NetworkStack(app, "MythicalMysfits-Network", {env});
const ecrStack = new EcrStack(app, "MythicalMysfits-ECR", {env});
// 2 deploy 
const ecsStack = new EcsStack(app, "MythicalMysfits-ECS", {
    env,
    vpc: networkStack.vpc,
    ecrRepository: ecrStack.ecrRepository
});
new CiCdStack(app, "MythicalMysfits-CICD", {
    env,
    githubOwner:"debrajpaul",
    githubRepo:"MythicalMysfits-Website",
    githubTokenSecretName: "github-token-secret",
    ecrRepository: ecrStack.ecrRepository,
    ecsService: ecsStack.ecsService.service
});