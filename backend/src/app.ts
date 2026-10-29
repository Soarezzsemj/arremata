import express from 'express';
import cors from 'cors';
import { config } from './config';
import { healthRouter } from './routes/health';
import { authRouter } from './routes/auth';
import { notFound } from './lib/errors';
import { errorHandler } from './lib/http';
import { auctioneerRouter } from './routes/auctioneer';
import { lotsRouter } from './routes/lots';
import { imagesRouter } from './routes/images';
import { meRouter } from './routes/me';
import { receiptsRouter } from './routes/receipts';


export const app = express();

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/auctioneer', auctioneerRouter);
app.use('/api/lots', lotsRouter);
app.use('/api/images', imagesRouter);
app.use('/api/me', meRouter);
app.use('/api/receipts', receiptsRouter);

app.use((_req, _res, next) => {
  next(notFound('Rota não encontrada'));
});

app.use(errorHandler);