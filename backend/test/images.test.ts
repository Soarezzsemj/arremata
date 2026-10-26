import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';

// Cada teste usa um id diferente porque o cache em memória dura o processo todo
const ID_OK = '3c27b499-af56-f0d5-93b5-a7f2f1ad5813';
const ID_CHALLENGE = '11111111-2222-3333-4444-555555555555';
const ID_CACHE = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

function jpegResponse() {
  return new Response(JPEG, { status: 200, headers: { 'Content-Type': 'image/jpeg' } });
}

describe('GET /api/images/:imageId', () => {
  // Nada de internet: o fetch global é trocado por um mock em cada teste
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('responde 400 para id que não é UUID', async () => {
    const res = await request(app).get('/api/images/nao-e-uuid');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('responde 400 para largura fora da lista', async () => {
    const res = await request(app).get(`/api/images/${ID_OK}?w=1000`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('responde 200 com a imagem do museu', async () => {
    fetchMock.mockResolvedValueOnce(jpegResponse());

    const res = await request(app).get(`/api/images/${ID_OK}?w=400`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/jpeg');
    expect(res.headers['cache-control']).toBe('public, max-age=86400');
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(Buffer.compare(res.body as Buffer, JPEG)).toBe(0);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      `https://www.artic.edu/iiif/2/${ID_OK}/full/400,/0/default.jpg`,
    );
  });

  it('responde 503 quando o museu devolve o desafio do Cloudflare (403 + HTML)', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('<html>Just a moment...</html>', {
        status: 403,
        headers: { 'Content-Type': 'text/html; charset=UTF-8' },
      }),
    );

    const res = await request(app).get(`/api/images/${ID_CHALLENGE}`);

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('EXTERNAL_API_UNAVAILABLE');
  });

  it('serve a segunda chamada igual a partir do cache', async () => {
    fetchMock.mockResolvedValue(jpegResponse());

    const first = await request(app).get(`/api/images/${ID_CACHE}?w=200`);
    const second = await request(app).get(`/api/images/${ID_CACHE}?w=200`);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
