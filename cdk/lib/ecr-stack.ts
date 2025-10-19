import {
  Stack,
  StackProps,
  aws_ecr as ecr,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class EcrStack extends Stack {
  public readonly ecrRepository: ecr.Repository;

  constructor(scope: Construct, id:string, props?:StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    this.ecrRepository = new ecr.Repository(this, "Repository", {
      repositoryName: "mythicalmysfits/service"
    });
  }
}