import {
  Stack,
  StackProps,
  CfnOutput,
  aws_cognito as cognito
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class CognitoStack extends Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id:string, props?:StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    // define the Amazon Cognito UserPool
   this.userPool = new cognito.UserPool(this, 'UserPool', {
        userPoolName: 'MysfitsUserPool',
        autoVerify: {
            email: true
        }
    });
    // define a Amazon Cognito User Pool Client, which our web application will use
    this.userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
        userPool: this.userPool,
        userPoolClientName: 'MysfitsUserPoolClient'
    });

    //  the Cognito User Pool ID and the Cognito User Pool Client ID by defining custom output properties defining cdk.CfnOutput constructs.
    new CfnOutput(this, "CognitoUserPool", {
        description: "The Cognito User Pool",
        value: this.userPool.userPoolId
    });

    //  Declare cdk.CfnOutput both for the Cognito User Pool ID and the Cognito User Pool Client ID.
    new CfnOutput(this, "CognitoUserPoolClient", {
        description: "The Cognito User Pool Client",
        value: this.userPoolClient.userPoolClientId
    });
  }
}