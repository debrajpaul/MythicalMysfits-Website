import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

const TABLE_NAME = 'MysfitsTable';

export interface MysfitSummary {
  mysfitId: string;
  name: string;
  species: string;
  goodevil: string;
  lawchaos: string;
  thumbImageUri: string;
}

export interface QueryParams {
  filter: string;
  value: string;
}

export interface MysfitsResponse {
  mysfits: MysfitSummary[];
}

export interface Mysfit extends MysfitSummary {
  description: string;
  age: number;
  profileImageUri: string;
  likes: number;
  adopted: boolean;
}

export interface UpdateResponse {
  Update: 'Success';
}

export class MysfitsTableClient {
  private readonly tableName: string;
  private readonly client: DynamoDBDocumentClient;

  constructor() {
    const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;
    this.tableName = TABLE_NAME;
    this.client = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
  }

  async getAllMysfits(): Promise<MysfitsResponse> {
    const response = await this.client.send(
      new ScanCommand({
        TableName: this.tableName,
      }),
    );

    const items = response.Items ?? [];
    return {
      mysfits: items.map((item) => this.toMysfitSummary(item)),
    };
  }

  async queryMysfits({ filter, value }: QueryParams): Promise<MysfitsResponse> {
    const response = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: `${filter}Index`,
        KeyConditionExpression: '#filter = :value',
        ExpressionAttributeNames: {
          '#filter': filter,
        },
        ExpressionAttributeValues: {
          ':value': value,
        },
      }),
    );

    const items = response.Items ?? [];
    return {
      mysfits: items.map((item) => this.toMysfitSummary(item)),
    };
  }

  async getMysfit(mysfitId: string): Promise<Mysfit> {
    const response = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { MysfitId: mysfitId },
      }),
    );

    if (!response.Item) {
      throw new Error(`Mysfit ${mysfitId} not found`);
    }

    return this.toMysfit(response.Item);
  }

  async likeMysfit(mysfitId: string): Promise<UpdateResponse> {
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { MysfitId: mysfitId },
        UpdateExpression: 'SET Likes = Likes + :inc',
        ExpressionAttributeValues: {
          ':inc': 1,
        },
      }),
    );

    return { Update: 'Success' };
  }

  async adoptMysfit(mysfitId: string): Promise<UpdateResponse> {
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { MysfitId: mysfitId },
        UpdateExpression: 'SET Adopted = :value',
        ExpressionAttributeValues: {
          ':value': true,
        },
      }),
    );

    return { Update: 'Success' };
  }

  private toMysfitSummary(item: Record<string, unknown>): MysfitSummary {
    return {
      mysfitId: this.asString(item['MysfitId']),
      name: this.asString(item['Name']),
      species: this.asString(item['Species']),
      goodevil: this.asString(item['GoodEvil']),
      lawchaos: this.asString(item['LawChaos']),
      thumbImageUri: this.asString(item['ThumbImageUri']),
    };
  }

  private toMysfit(item: Record<string, unknown>): Mysfit {
    return {
      ...this.toMysfitSummary(item),
      description: this.asString(item['Description']),
      age: this.asNumber(item['Age']),
      profileImageUri: this.asString(item['ProfileImageUri']),
      likes: this.asNumber(item['Likes']),
      adopted: this.asBoolean(item['Adopted']),
    };
  }

  private asString(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }
    throw new Error('Expected string attribute from DynamoDB');
  }

  private asNumber(value: unknown): number {
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'string' && value.trim().length > 0 && !Number.isNaN(Number(value))) {
      return Number(value);
    }
    throw new Error('Expected numeric attribute from DynamoDB');
  }

  private asBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    throw new Error('Expected boolean attribute from DynamoDB');
  }
}

export const mysfitsTableClient = new MysfitsTableClient();
