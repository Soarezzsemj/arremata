import express from 'express';
import cors from 'cors';
import { config } from './config';
import { healthRouter } from './routes/health';
import { authRouter } from './routes/auth';
import { notFound } from './lib/errors';
import { errorHandler } from './lib/http';
import { auctioneerRouter } from './routes/auctioneer';
import { lotsRouter } from './routes/lots';

// O app fica separado do server.ts para os testes usarem o Express sem abrir uma porta.
export const app = express();

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/auctioneer', auctioneerRouter);
app.use('/api/lots', lotsRouter);

app.use((_req, _res, next) => {
  next(notFound('Rota não encontrada'));
});

app.use(errorHandler);