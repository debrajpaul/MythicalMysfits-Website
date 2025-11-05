import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import { FilterCategory, mysfitsTableClient } from './mysfitsTableClient';

const app = express();
app.disable('x-powered-by');
app.use(cors());

const sendJson = (res: Response, payload: unknown, status = 200): void => {
  res.status(status).type('application/json').send(JSON.stringify(payload));
};

const isFilterCategory = (value: string): value is FilterCategory =>
  value === 'GoodEvil' || value === 'LawChaos';

app.get('/', (_req: Request, res: Response) => {
  sendJson(res, { message: 'Nothing here, used for health check. Try /mysfits instead.' });
});

app.get('/mysfits', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawFilter =
      typeof req.query.filter === 'string' && req.query.filter.length > 0
        ? req.query.filter
        : undefined;

    if (rawFilter) {
      if (!isFilterCategory(rawFilter)) {
        sendJson(
          res,
          { message: 'Query parameter "filter" must be either "GoodEvil" or "LawChaos".' },
          400,
        );
        return;
      }

      const filterCategory: FilterCategory = rawFilter;

      const filterValue =
        typeof req.query.value === 'string' && req.query.value.length > 0
          ? req.query.value
          : undefined;

      if (!filterValue) {
        sendJson(res, { message: 'Query parameter "value" is required when using "filter".' }, 400);
        return;
      }

      const response = await mysfitsTableClient.queryMysfits({
        filter: filterCategory,
        value: filterValue,
      });
      sendJson(res, response);
      return;
    }

    const response = await mysfitsTableClient.getAllMysfits();
    sendJson(res, response);
  } catch (error) {
    next(error);
  }
});

app.get('/mysfits/:mysfitId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { mysfitId } = req.params;
    const response = await mysfitsTableClient.getMysfit(mysfitId);
    sendJson(res, response);
  } catch (error) {
    next(error);
  }
});

app.post('/mysfits/:mysfitId/like', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { mysfitId } = req.params;
    const response = await mysfitsTableClient.likeMysfit(mysfitId);
    sendJson(res, response);
  } catch (error) {
    next(error);
  }
});

app.post('/mysfits/:mysfitId/adopt', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { mysfitId } = req.params;
    const response = await mysfitsTableClient.adoptMysfit(mysfitId);
    sendJson(res, response);
  } catch (error) {
    next(error);
  }
});

app.use((err: unknown, _req: Request, res: Response) => {
  console.error(err);
  if (err instanceof Error && /not found/i.test(err.message)) {
    sendJson(res, { message: err.message }, 404);
    return;
  }
  sendJson(res, { message: 'Failed to load mysfits data.' }, 500);
});

const port = Number(process.env.PORT) || 8080;

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Mythical Mysfits API listening on port ${port}`);
  });
}

export { app };
