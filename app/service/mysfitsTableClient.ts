import {
  DynamoDBDocumentClient,
  QueryCommand,
  QueryCommandInput,
  ScanCommand,
  ScanCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

const TABLE_NAME = 'MysfitsTable';

export interface Mysfit {
  mysfitId: string;
  name: string;
  species: string;
  description: string;
  age: number;
  goodevil: string;
  lawchaos: string;
  thumbImageUri: string;
  profileImageUri: string;
  likes: number;
  adopted: boolean;
}

export interface QueryParams {
  filter: string;
  value: string;
}

export class MysfitsTableClient {
  private readonly tableName: string;
  private readonly client: DynamoDBDocumentClient;

  constructor() {
    this.tableName = TABLE_NAME;
    this.client = new DynamoDBClient({ region: 'ap-south-1' });
  }

  async getAllMysfits(): Promise<Mysfit[]> {
    const scanInput: ScanCommandInput = {
      TableName: this.tableName,
    };
    const response = await this.client.send(new ScanCommand(scanInput));

    return (response.Items as Mysfit[]) ?? [];
  }

  async queryMysfitItems(filter: string, value: string): Promise<Mysfit[]> {
    const queryInput: QueryCommandInput = {
      TableName: this.tableName,
      KeyConditionExpression: '#filter = :value',
      ExpressionAttributeNames: {
        '#filter': filter,
      },
      ExpressionAttributeValues: {
        ':value': value,
      },
    };
    const response = await this.client.send(new QueryCommand(queryInput));

    return (response.Items as Mysfit[]) ?? [];
  }

  async queryMysfits({ filter, value }: QueryParams): Promise<Mysfit[]> {
    return this.queryMysfitItems(filter, value);
  }
}

export const mysfitsTableClient = new MysfitsTableClient();
