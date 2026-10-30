import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { fetchImage, imageCacheStatsForTests, resetImageCachesForTests } from '../src/services/images';

const ID = '3c27b499-af56-f0d5-93b5-a7f2f1ad5813';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

function jpegResponse(body: Uint8Array<ArrayBuffer> = new Uint8Array(JPEG)) {
  return new Response(body, { status: 200, headers: { 'Content-Type': 'image/jpeg' } });
}

describe('imagens: resiliência ao museu', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    resetImageCachesForTests();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('timeout do museu: 503', async () => {
    fetchMock.mockRejectedValueOnce(new DOMException('The operation was aborted due to timeout', 'TimeoutError'));

    const res = await request(app).get(`/api/images/${ID}`);

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('EXTERNAL_API_UNAVAILABLE');
  });

  it('5xx do museu: 503, e a chamada seguinte sai do cache de falha sem ir ao museu', async () => {
    fetchMock.mockResolvedValue(new Response('erro', { status: 502 }));

    const first = await request(app).get(`/api/images/${ID}`);
    const second = await request(app).get(`/api/images/${ID}`);

    expect(first.status).toBe(503);
    expect(second.status).toBe(503);
    expect(second.body.error.code).toBe('EXTERNAL_API_UNAVAILABLE');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('cache de falha vence em 30 s e um sucesso depois disso é servido', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
    fetchMock.mockResolvedValueOnce(new Response('devagar', { status: 429 }));
    expect((await request(app).get(`/api/images/${ID}`)).status).toBe(503);

    vi.setSystemTime(new Date('2026-01-01T12:00:31Z'));
    fetchMock.mockResolvedValueOnce(jpegResponse());
    const res = await request(app).get(`/api/images/${ID}`);

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(imageCacheStatsForTests().failures).toBe(0);
  });

  it('10 pedidos simultâneos da mesma imagem fazem um único fetch', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    fetchMock.mockImplementation(async () => {
      await gate;
      return jpegResponse();
    });

    const all = Promise.all(Array.from({ length: 10 }, () => fetchImage(ID, 400)));
    release();
    const images = await all;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(images.every((img) => Buffer.compare(img.body, JPEG) === 0)).toBe(true);
  });

  it('404 do museu: responde 404 IMAGE_NOT_FOUND com Cache-Control curto e guarda a falha', async () => {
    fetchMock.mockResolvedValue(new Response('não achei', { status: 404 }));

    const first = await request(app).get(`/api/images/${ID}`);
    const second = await request(app).get(`/api/images/${ID}`);

    expect(first.status).toBe(404);
    expect(first.body.error.code).toBe('IMAGE_NOT_FOUND');
    expect(first.headers['cache-control']).toBe('public, max-age=300');
    expect(second.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('imagem acima de 2 MB: 503 e não entra no cache', async () => {
    fetchMock.mockResolvedValueOnce(jpegResponse(new Uint8Array(2 * 1024 * 1024 + 1)));

    const res = await request(app).get(`/api/images/${ID}`);

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('EXTERNAL_API_UNAVAILABLE');
    expect(imageCacheStatsForTests()).toMatchObject({ entries: 0, bytes: 0 });
  });

  it('acerto no cache renova a posição da entrada (LRU)', async () => {
    fetchMock.mockImplementation(async () => jpegResponse());
    const ids = Array.from({ length: 200 }, (_, i) => `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`);
    for (const id of ids) await fetchImage(id, 200);

    await fetchImage(ids[0], 200);
    await fetchImage(ID, 200); 
    fetchMock.mockClear();

    await fetchImage(ids[0], 200);
    expect(fetchMock).not.toHaveBeenCalled();
    await fetchImage(ids[1], 200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
