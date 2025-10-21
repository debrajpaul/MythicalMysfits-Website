import {
  Aws,
  Stack,
  CfnOutput,
  StackProps,
  aws_iam as iam,
  aws_ecr as ecr,
  aws_ecs as ecs,
  aws_ssm as ssm,
  aws_codebuild as codebuild,
  aws_codepipeline as codepipeline,
  aws_codepipeline_actions as codepipeline_actions,
  SecretValue,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

interface CiCdStackProps extends StackProps {
  ecrRepository: ecr.Repository;
  ecsService: ecs.FargateService;
  githubOwner: string;             // e.g. 'debrajpaul'
  githubRepo: string;              // e.g. 'MythicalMysfits-Website'
  githubTokenSecretName: string;   // Secrets Manager name for the PAT
}

export class CiCdStack extends Stack {

  constructor(scope: Construct, id:string, props:CiCdStackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    // write/copy the following code to define our CodeBuild project to build
    const codebuildProject = new codebuild.PipelineProject(this, "BuildProject", {
      projectName: "MythicalMysfitsServiceCodeBuildProject",
      environment: {
        computeType: codebuild.ComputeType.SMALL,
        buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2023_4,
        privileged: true,
        environmentVariables: {
          AWS_ACCOUNT_ID: {
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
            value: Aws.ACCOUNT_ID
          },
          AWS_DEFAULT_REGION: {
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
            value: Aws.REGION
          }
        }
      }
    });

    // Add permissions for the CodeBuild project to pull and push images to/from the ECR repository
    props.ecrRepository.grantPullPush(codebuildProject.grantPrincipal);
    // Allow CodeBuild to deploy to ECS/Fargate
    codebuildProject.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'ecs:DescribeCluster',
          'ecs:DescribeServices',
          'ecr:GetAuthorizationToken',
          'ecr:BatchCheckLayerAvailability',
          'ecr:GetDownloadUrlForLayer',
          'ecr:BatchGetImage',
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
        ],
        resources: ['*'],
      }),
    );

    // let's define the CodePipeline Source action which specifies where to obtain the web app source
    const sourceOutput = new codepipeline.Artifact();
    const sourceAction = new codepipeline_actions.GitHubSourceAction({
    actionName: 'GitHub_Source',
    owner: props.githubOwner,
    repo: props.githubRepo,
    branch: "main",
    oauthToken: SecretValue.secretsManager(props.githubTokenSecretName),
    trigger: codepipeline_actions.GitHubTrigger.WEBHOOK,
    output: sourceOutput
    });

    // CodePipeline Build action that uses the CodeBuild project we created earlier to build the Docker image
    const buildOutput = new codepipeline.Artifact();
    const buildAction = new codepipeline_actions.CodeBuildAction({
        actionName: "Build",
        input: sourceOutput,
        outputs: [
            buildOutput
        ],
        project: codebuildProject
    });

    // ECS deployment action to tell CodePipeline how to deploy the output of the BuildAction
    const deployAction = new codepipeline_actions.EcsDeployAction({
        actionName: "DeployAction",
        service: props.ecsService,
        input: buildOutput
    });
    //  CodePipeline pipeline and stitch all the stages/actions together
    const pipeline = new codepipeline.Pipeline(this, "Pipeline", {
        pipelineName: "MythicalMysfitsPipeline"
    });
    pipeline.addStage({
        stageName: "Source",
        actions: [sourceAction]
    });
    pipeline.addStage({
        stageName: "Build",
        actions: [buildAction]
    });
    pipeline.addStage({
        stageName: "Deploy",
        actions: [deployAction]
    });

    new CfnOutput(this, 'GitHubRepo', {
      description: 'GitHub repository used by the pipeline',
      value: `https://github.com/${props.githubOwner}/${props.githubRepo}.git`,
    });
  }
}