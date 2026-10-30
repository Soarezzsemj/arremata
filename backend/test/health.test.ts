import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const queryRaw = vi.hoisted(() => vi.fn());
vi.mock('../src/db', () => ({ prisma: { $queryRaw: queryRaw } }));

import { app } from '../src/app';

describe('GET /api/health com o banco fora', () => {
  beforeEach(() => {
    queryRaw.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('banco com erro: 503 degraded, sem detalhes do erro', async () => {
    queryRaw.mockRejectedValueOnce(new Error('Can not reach database server at db.exemplo:5432 user=segredo'));

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'degraded', db: 'down' });
    expect(JSON.stringify(res.body)).not.toContain('segredo');
  });

  it('banco que não responde: 503 depois de ~3 s, sem pendurar', async () => {
    queryRaw.mockReturnValueOnce(new Promise(() => {}));

    const started = Date.now();
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'degraded', db: 'down' });
    expect(Date.now() - started).toBeLessThan(4_500);
  }, 8_000);
});
