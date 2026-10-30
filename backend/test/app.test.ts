import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';

describe('app', () => {
  it('responde 404 no formato de erro padrão', async () => {
    const res = await request(app).get('/api/rota-que-nao-existe');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Rota não encontrada' },
    });
  });
});


describe.skipIf(!process.env.RUN_DB_TESTS)('GET /api/health (com banco)', () => {
  it('responde 200 quando o banco está no ar', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
