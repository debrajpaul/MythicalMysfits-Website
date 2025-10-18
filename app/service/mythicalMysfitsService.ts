import cors from 'cors';
import mysfitsResponse from './mysfits-response.json';
import express, { Request, Response } from 'express';

const app = express();
app.disable('x-powered-by');
app.use(cors());

app.get('/', (_req: Request, res: Response) => {
  res.json({ message: 'Nothing here, used for health check. Try /mysfits instead.' });
});

app.get('/mysfits', (_req: Request, res: Response) => {
  res.json(mysfitsResponse);
});

app.use((err: unknown, _req: Request, res: Response) => {
  console.error(err);
  res.status(500).json({ message: 'Failed to load mysfits data.' });
});

const port = Number(process.env.PORT) || 8080;
app.listen(port, () => {
  console.log(`Mythical Mysfits API listening on port ${port}`);
});
