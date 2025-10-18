import {
  Stack,
  aws_ec2 as ec2,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class NetworkStack extends Stack {
    public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id:string) {
    super(scope, id);

    // The code that defines your stack goes here
    this.vpc = new ec2.Vpc(this, "VPC",{
        natGateways:1,
        maxAzs: 2,
    });
  }
}