import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import { mysfitsTableClient } from './mysfitsTableClient';

const app = express();
app.disable('x-powered-by');
app.use(cors());

app.get('/', (_req: Request, res: Response) => {
  res.json({ message: 'Nothing here, used for health check. Try /mysfits instead.' });
});

app.get('/mysfits', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filterCategory = req.query.filter;
    if (typeof filterCategory === 'string' && filterCategory.length > 0) {
      const filterValue = req.query.value;
      if (typeof filterValue !== 'string' || filterValue.length === 0) {
        res
          .status(400)
          .json({ message: 'Query parameter "value" is required when using "filter".' });
        return;
      }

      const response = await mysfitsTableClient.queryMysfits({
        filter: filterCategory,
        value: filterValue,
      });
      res.json(response);
      return;
    }

    const response = await mysfitsTableClient.getAllMysfits();
    res.json(response);
  } catch (error) {
    next(error);
  }
});

app.get('/mysfits/:mysfitId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { mysfitId } = req.params;
    const response = await mysfitsTableClient.getMysfit(mysfitId);
    res.json(response);
  } catch (error) {
    next(error);
  }
});

app.post('/mysfits/:mysfitId/like', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { mysfitId } = req.params;
    const response = await mysfitsTableClient.likeMysfit(mysfitId);
    res.json(response);
  } catch (error) {
    next(error);
  }
});

app.post('/mysfits/:mysfitId/adopt', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { mysfitId } = req.params;
    const response = await mysfitsTableClient.adoptMysfit(mysfitId);
    res.json(response);
  } catch (error) {
    next(error);
  }
});

app.use((err: unknown, _req: Request, res: Response) => {
  console.error(err);
  res.status(500).json({ message: 'Failed to load mysfits data.' });
});

const port = Number(process.env.PORT) || 8080;
app.listen(port, () => {
  console.log(`Mythical Mysfits API listening on port ${port}`);
});
