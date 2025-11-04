import {
  Stack,
  StackProps,
  RemovalPolicy,
  aws_iam as iam,
  aws_ecs as ecs,
  aws_ec2 as ec2,
  aws_dynamodb as dynamodb
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

interface DynamoDbStackProps extends StackProps {
  vpc: ec2.Vpc;
  fargateService: ecs.FargateService;
}

export class DynamoDbStack extends Stack {
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id:string, props:DynamoDbStackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    // define a VPC endpoint to allow a secure path for traffic to travel between our VPC and the DynamoDB database
    const dynamoDbEndpoint = props.vpc.addGatewayEndpoint("DynamoDbEndpoint", {
        service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
        subnets: [{
            subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
        }]
    });

    const dynamoDbPolicy = new iam.PolicyStatement();
    dynamoDbPolicy.addAnyPrincipal();
    dynamoDbPolicy.addActions("*");
    dynamoDbPolicy.addAllResources();
    dynamoDbEndpoint.addToPolicy(
        dynamoDbPolicy
    );
    this.table = new dynamodb.Table(this, "Table", {
        tableName: "MysfitsTable",
        partitionKey: {
            name: "MysfitId",
            type: dynamodb.AttributeType.STRING
        },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        removalPolicy: RemovalPolicy.DESTROY // use RETAIN for production
    });
    this.table.addGlobalSecondaryIndex({
        indexName: "LawChaosIndex",
        partitionKey: {
            name: 'LawChaos',
            type: dynamodb.AttributeType.STRING
        },
        sortKey: {
            name: 'MysfitId',
            type: dynamodb.AttributeType.STRING
        },
        projectionType: dynamodb.ProjectionType.ALL
    });
    this.table.addGlobalSecondaryIndex({
        indexName: "GoodEvilIndex",
        partitionKey: {
            name: 'GoodEvil',
            type: dynamodb.AttributeType.STRING
        },
        sortKey: {
            name: 'MysfitId',
            type: dynamodb.AttributeType.STRING
        },
        projectionType: dynamodb.ProjectionType.ALL
    });

    // we need to allow our ECS Cluster access to our DynamoDB by adding an IAM Role defining the permissions required
    const fargatePolicy = new iam.PolicyStatement();
    fargatePolicy.addActions(
        //  Allows the ECS tasks to interact with only the MysfitsTable in DynamoDB
        "dynamodb:Scan",
        "dynamodb:Query",
        "dynamodb:UpdateItem",
        "dynamodb:GetItem",
        "dynamodb:DescribeTable"
    );
    fargatePolicy.addResources(
        "arn:aws:dynamodb:*:*:table/MysfitsTable*"
    );
    props.fargateService.taskDefinition.addToTaskRolePolicy(
        fargatePolicy
    );
  }
}
