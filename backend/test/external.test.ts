import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../src/lib/errors';
import { resetSearchCacheForTests, searchArtworks } from '../src/services/external';

const ARTWORK = { id: 1, title: 'Water Lilies', artist_display: 'Claude Monet', date_display: '1906', image_id: null };

function okResponse() {
  return new Response(JSON.stringify({ data: [ARTWORK] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function expectUnavailable(promise: Promise<unknown>) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(AppError);
  expect((err as AppError).status).toBe(503);
  expect((err as AppError).code).toBe('EXTERNAL_API_UNAVAILABLE');
}

describe('busca no museu (searchArtworks)', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    resetSearchCacheForTests();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('museu com 500 e sem cache: EXTERNAL_API_UNAVAILABLE (503)', async () => {
    fetchMock.mockResolvedValueOnce(new Response('erro', { status: 500 }));
    await expectUnavailable(searchArtworks('monet'));
  });

  it('museu com 429 e sem cache: EXTERNAL_API_UNAVAILABLE (503)', async () => {
    fetchMock.mockResolvedValueOnce(new Response('devagar', { status: 429, headers: { 'Retry-After': '30' } }));
    await expectUnavailable(searchArtworks('monet'));
  });

  it('timeout do museu: EXTERNAL_API_UNAVAILABLE (503)', async () => {
    fetchMock.mockRejectedValueOnce(new DOMException('The operation was aborted due to timeout', 'TimeoutError'));
    await expectUnavailable(searchArtworks('monet'));
  });

  it('museu falha com cache vencido: devolve o cache', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
    fetchMock.mockResolvedValueOnce(okResponse());
    const first = await searchArtworks('monet');

    vi.setSystemTime(new Date('2026-01-01T12:11:00Z'));
    fetchMock.mockResolvedValueOnce(new Response('erro', { status: 503 }));
    const second = await searchArtworks('monet');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(second).toEqual(first);
    expect(second[0].title).toBe('Water Lilies');
  });

  it('repetir a busca dentro do TTL não chama o museu de novo', async () => {
    fetchMock.mockResolvedValue(okResponse());

    await searchArtworks('monet');
    await searchArtworks('  MONET ');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
