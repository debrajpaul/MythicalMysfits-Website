import * as fs from "fs";
import * as path from "path";
import {
  Aws,
  Stack,
  StackProps,
  CfnOutput,
  aws_apigateway as apigateway,
  aws_elasticloadbalancingv2 as elbv2,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

interface APIGatewayStackProps extends StackProps {
  loadBalancerDnsName: string;
  loadBalancerArn: string;
  userPoolId: string;
}

export class APIGatewayStack extends Stack {

  constructor(scope: Construct, id:string, props:APIGatewayStackProps) {
    super(scope, id, props);
    // The code that defines your stack goes here
    // let's import the Network Load Balancer from the ECS Cluster created in Module 2
    const nlb = elbv2.NetworkLoadBalancer.fromNetworkLoadBalancerAttributes(this, 'NLB', {
      loadBalancerArn: props.loadBalancerArn,
    });
    // We then define a VPCLink for our API Gateway, attaching the NLB as the VPCLink target
    const vpcLink = new apigateway.VpcLink(this, 'VPCLink', {
      description: 'VPCLink for our  REST API',
      vpcLinkName: 'MysfitsApiVpcLink',
      targets: [
        nlb
      ]
    });
    const schema = this.generateSwaggerSpec(props.loadBalancerDnsName, props.userPoolId, vpcLink);
    const jsonSchema = JSON.parse(schema);
    const api = new apigateway.CfnRestApi(this, 'Schema', {
      name: 'MysfitsApi',
      body: jsonSchema,
      endpointConfiguration: {
        types: [
          apigateway.EndpointType.REGIONAL
        ]
      },
      failOnWarnings: true
    });

    const prod = new apigateway.CfnDeployment(this, 'Prod', {
        restApiId: api.ref,
        stageName: 'prod'
    });

    new CfnOutput(this, 'APIID', {
      value: api.ref,
      description: 'API Gateway ID'
    })
  }
  // we will write one helper function to import an API specified in a swagger file.
  private generateSwaggerSpec(dnsName: string, userPoolId:string, vpcLink: apigateway.VpcLink): string {
    try {
      const schemaFilePath = path.resolve(__dirname + '/../../api/api-swagger.json');
      console.log("path--> ",schemaFilePath)
      const apiSchema = fs.readFileSync(schemaFilePath);
      let schema: string = apiSchema.toString().replace(/REPLACE_ME_REGION/gi, Aws.REGION);
      schema = schema.toString().replace(/REPLACE_ME_ACCOUNT_ID/gi, Aws.ACCOUNT_ID);
      schema = schema.toString().replace(/REPLACE_ME_COGNITO_USER_POOL_ID/gi, userPoolId);
      schema = schema.toString().replace(/REPLACE_ME_VPC_LINK_ID/gi, vpcLink.vpcLinkId);
      schema = schema.toString().replace(/REPLACE_ME_NLB_DNS/gi, dnsName);
      return schema;
    } catch (exception) {
      throw new Error('Failed to generate swagger specification.  Please refer to the Module 4 readme for instructions.');
    }
  }
}