#!/usr/bin/env node
import 'source-map-support/register';
import { App } from 'aws-cdk-lib';
import { WebApplicationStack } from "../lib/web-application-stack";
import { NetworkStack } from "../lib/network-stack";
import { EcrStack } from "../lib/ecr-stack";
import { EcsStack } from "../lib/ecs-stack";

const env = {
  region: 'ap-south-1',
};

const app = new App();
new WebApplicationStack(app, "MythicalMysfits-Website-Showcase",{env});
const networkStack = new NetworkStack(app, "MythicalMysfits-Network", {env});
const ecrStack = new EcrStack(app, "MythicalMysfits-ECR", {env});
const ecsStack = new EcsStack(app, "MythicalMysfits-ECS", {
    env,
    vpc: networkStack.vpc,
    ecrRepository: ecrStack.ecrRepository
});