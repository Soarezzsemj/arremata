import { badRequest, externalUnavailable } from '../lib/errors';
import { USER_AGENT } from './external';

export type ImageFile = {
  body: Buffer;
  contentType: string;
};

const IIIF_URL = 'https://www.artic.edu/iiif/2';
const TIMEOUT_MS = 5000;
const CACHE_MAX_ENTRIES = 200;
const ALLOWED_WIDTHS = [200, 400, 843];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;


export function checkImageRequest(imageId: string, width: number): void {
  if (!UUID_REGEX.test(imageId)) throw badRequest('Identificador de imagem inválido.');
  if (!ALLOWED_WIDTHS.includes(width)) {
    throw badRequest(`Largura inválida. Use ${ALLOWED_WIDTHS.join(', ')}.`);
  }
}

async function fetchFromIiif(imageId: string, width: number): Promise<ImageFile> {
  const url = `${IIIF_URL}/${imageId}/full/${width},/0/default.jpg`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        Accept: 'image/jpeg,image/*',
        'User-Agent': USER_AGENT,
        'AIC-User-Agent': USER_AGENT,
      },
    });

  
    const contentType = res.headers.get('content-type') ?? '';
    if (!res.ok || !contentType.startsWith('image/')) {
      throw new Error(`Servidor de imagens respondeu ${res.status} (${contentType || 'sem content-type'})`);
    }

    return { body: Buffer.from(await res.arrayBuffer()), contentType };
  } catch (err) {
    console.error('Falha ao buscar imagem no Art Institute:', err);
    throw externalUnavailable('Não foi possível carregar a imagem agora. Tente novamente em instantes.');
  }
}

const cache = new Map<string, ImageFile>();

export async function fetchImage(imageId: string, width: number): Promise<ImageFile> {
  const key = `${imageId}:${width}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const image = await fetchFromIiif(imageId, width);

  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, image);

  return image;
}
