import { AppError, badRequest, externalUnavailable } from '../lib/errors';
import { USER_AGENT } from './external';

export type ImageFile = {
  body: Buffer;
  contentType: string;
};

const IIIF_URL = 'https://www.artic.edu/iiif/2';
const IMAGE_TIMEOUT_MS = 3_000;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const CACHE_MAX_ENTRIES = 200;
const CACHE_MAX_BYTES = 50 * 1024 * 1024;
const FAILURE_TTL_MS = 30_000;
const NOT_FOUND_TTL_MS = 5 * 60_000;
const FAILURE_MAX_ENTRIES = 1_000;
const ALLOWED_WIDTHS = [200, 400, 843];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const UNAVAILABLE_MESSAGE = 'Não foi possível carregar a imagem agora. Tente novamente em instantes.';

export function imageNotFound(): AppError {
  return new AppError(404, 'IMAGE_NOT_FOUND', 'Imagem não encontrada no museu.');
}

export function checkImageRequest(imageId: string, width: number): void {
  if (!UUID_REGEX.test(imageId)) throw badRequest('Identificador de imagem inválido.');
  if (!ALLOWED_WIDTHS.includes(width)) {
    throw badRequest(`Largura inválida. Use ${ALLOWED_WIDTHS.join(', ')}.`);
  }
}
async function readLimited(res: Response, maxBytes: number): Promise<Buffer | null> {
  const declared = Number(res.headers.get('content-length'));
  if (declared > maxBytes) {
    await res.body?.cancel();
    return null;
  }
  if (!res.body) return Buffer.alloc(0);

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

async function fetchFromIiif(imageId: string, width: number): Promise<ImageFile> {
  const url = `${IIIF_URL}/${imageId}/full/${width},/0/default.jpg`;

  let res: Response;
  try {
    res = await fetch(url, {
      signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
      headers: {
        Accept: 'image/jpeg,image/*',
        'User-Agent': USER_AGENT,
        'AIC-User-Agent': USER_AGENT,
      },
    });
  } catch (err) {
    console.error('Falha ao buscar imagem no Art Institute:', err instanceof Error ? err.name : 'erro');
    throw externalUnavailable(UNAVAILABLE_MESSAGE);
  }

  if (res.status === 404) {
    await res.body?.cancel();
    throw imageNotFound();
  }

  const contentType = res.headers.get('content-type') ?? '';
  if (!res.ok || !contentType.startsWith('image/')) {
    await res.body?.cancel();
    console.error(`Servidor de imagens respondeu ${res.status} (${contentType || 'sem content-type'})`);
    throw externalUnavailable(UNAVAILABLE_MESSAGE);
  }

  let body: Buffer | null;
  try {
    body = await readLimited(res, MAX_IMAGE_BYTES);
  } catch (err) {
    console.error('Falha ao ler imagem do Art Institute:', err instanceof Error ? err.name : 'erro');
    throw externalUnavailable(UNAVAILABLE_MESSAGE);
  }
  if (body === null) {
    console.error(`Imagem ${imageId} acima de ${MAX_IMAGE_BYTES} bytes, descartada`);
    throw externalUnavailable(UNAVAILABLE_MESSAGE);
  }

  return { body, contentType };
}

const cache = new Map<string, ImageFile>();
let cacheBytes = 0;
const failures = new Map<string, { error: AppError; until: number }>();
const inFlight = new Map<string, Promise<ImageFile>>();

function remember(key: string, image: ImageFile) {
  const size = image.body.byteLength;
  while (cache.size > 0 && (cache.size >= CACHE_MAX_ENTRIES || cacheBytes + size > CACHE_MAX_BYTES)) {
    const [oldestKey, oldest] = cache.entries().next().value!;
    cache.delete(oldestKey);
    cacheBytes -= oldest.body.byteLength;
  }
  cache.set(key, image);
  cacheBytes += size;
}

function rememberFailure(key: string, error: AppError) {
  if (!failures.has(key) && failures.size >= FAILURE_MAX_ENTRIES) {
    const oldest = failures.keys().next().value;
    if (oldest !== undefined) failures.delete(oldest);
  }
  const ttl = error.code === 'IMAGE_NOT_FOUND' ? NOT_FOUND_TTL_MS : FAILURE_TTL_MS;
  failures.set(key, { error, until: Date.now() + ttl });
}

export async function fetchImage(imageId: string, width: number): Promise<ImageFile> {
  const key = `${imageId}:${width}`;

  const cached = cache.get(key);
  if (cached) {
    cache.delete(key);
    cache.set(key, cached);
    return cached;
  }

  const failure = failures.get(key);
  if (failure) {
    if (failure.until > Date.now()) throw failure.error;
    failures.delete(key);
  }

  const pending = inFlight.get(key);
  if (pending) return pending;

  const promise = (async () => {
    try {
      const image = await fetchFromIiif(imageId, width);
      failures.delete(key);
      remember(key, image);
      return image;
    } catch (err) {
      const error = err instanceof AppError ? err : externalUnavailable(UNAVAILABLE_MESSAGE);
      rememberFailure(key, error);
      throw error;
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, promise);
  return promise;
}

// p teste
export function resetImageCachesForTests() {
  cache.clear();
  cacheBytes = 0;
  failures.clear();
  inFlight.clear();
}

export function imageCacheStatsForTests() {
  return { entries: cache.size, bytes: cacheBytes, failures: failures.size };
}
