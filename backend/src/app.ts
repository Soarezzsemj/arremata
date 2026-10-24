import express from 'express';
import cors from 'cors';
import { config } from './config';
import { healthRouter } from './routes/health';

// O app fica separado do server.ts para os testes usarem o Express sem abrir uma porta.
export const app = express();

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.use('/api', healthRouter);

// Qualquer rota que não existe responde no formato de erro padrão da API
app.use((_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Rota não encontrada' } });
});

// Erro inesperado: registra no log e não vaza detalhes internos para o cliente
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Erro interno do servidor' } });
});
