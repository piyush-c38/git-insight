import express, { Express, Request, Response, NextFunction } from 'express';
import { ApiError, handleErrors } from './lib/errors';
import apiRoutes from './api/routes/index';
import config from './config';
import { embeddingPoolService } from './services/embedding-pool.service';

const app: Express = express();
const port = config.port;

app.use(express.json());

app.use((req, res, next) => {
  const origin = config.corsOrigin || req.headers.origin || '*';

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

app.get('/health', (_req, res) => res.status(200).json({ ok: true }));

app.use('/api', apiRoutes);

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({ message: err.message });
  } else {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.listen(port, () => {
  console.log(`[server]: Server is running on port ${port}`);
  void embeddingPoolService
    .embedQuery('warmup')
    .then(() => console.log('[server]: Embedding worker pool warmed up'))
    .catch((error: Error) => {
      console.warn('[server]: Embedding worker warmup failed:', error.message);
    });
});
