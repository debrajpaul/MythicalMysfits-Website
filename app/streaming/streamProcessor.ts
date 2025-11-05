import { Mysfit, mysfitsTableClient } from '../service/mysfitsTableClient';

interface FirehoseTransformationRecord {
  recordId: string;
  data: string;
}

interface FirehoseTransformationEvent {
  records: FirehoseTransformationRecord[];
}

interface FirehoseTransformationResultRecord {
  recordId: string;
  result: 'Ok';
  data: string;
}

interface FirehoseTransformationResult {
  records: FirehoseTransformationResultRecord[];
}

interface ClickRecord {
  userId: string;
  mysfitId: string | number;
  [key: string]: unknown;
}

type MysfitAttributes = Pick<Mysfit, 'goodevil' | 'lawchaos' | 'species'>;

export class MysfitsStreamProcessor {
  async process(event: FirehoseTransformationEvent): Promise<FirehoseTransformationResult> {
    const output: FirehoseTransformationResultRecord[] = [];

    for (const record of event.records) {
      console.log(`Processing record: ${record.recordId}`);

      const decodedPayload = Buffer.from(record.data, 'base64').toString('utf8');
      const click = JSON.parse(decodedPayload) as ClickRecord;

      const mysfit = await this.retrieveMysfit(click.mysfitId);

      const enrichedClick = {
        userId: click.userId,
        mysfitId: click.mysfitId,
        goodevil: mysfit.goodevil,
        lawchaos: mysfit.lawchaos,
        species: mysfit.species,
      };

      const encodedEnrichedClick = Buffer.from(
        `${JSON.stringify(enrichedClick)}\n`,
        'utf8',
      ).toString('base64');

      output.push({
        recordId: record.recordId,
        result: 'Ok',
        data: encodedEnrichedClick,
      });
    }

    console.log(`Successfully processed ${event.records.length} records.`);

    return { records: output };
  }

  private async retrieveMysfit(mysfitId: string | number): Promise<MysfitAttributes> {
    try {
      const { goodevil, lawchaos, species } = await mysfitsTableClient.getMysfit(String(mysfitId));
      return { goodevil, lawchaos, species };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to retrieve mysfit ${mysfitId}: ${message}`);
    }
  }
}

const processor = new MysfitsStreamProcessor();

export async function processRecord(
  event: FirehoseTransformationEvent,
): Promise<FirehoseTransformationResult> {
  return processor.process(event);
}

export const handler = processRecord;
