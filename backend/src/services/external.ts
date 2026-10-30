import { externalUnavailable } from '../lib/errors';

export type ExternalItem = {
  externalSource: string;
  externalId: string;
  title: string;
  imageUrl: string | null;
  attributes: Record<string, string>;
};

type ArticArtwork = {
  id: number;
  title?: string | null;
  artist_display?: string | null;
  date_display?: string | null;
  image_id?: string | null;
};

const ARTIC_SEARCH_URL = 'https://api.artic.edu/api/v1/artworks/search';
const IIIF_URL = 'https://www.artic.edu/iiif/2';
export const USER_AGENT = 'Arremata/1.0 (teste tecnico de leilao)';
const TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 10 * 60 * 1000; 
const CACHE_MAX_ENTRIES = 100;


function toExternalItem(art: ArticArtwork): ExternalItem {
  const attributes: Record<string, string> = {};
  if (art.artist_display) attributes.Artista = art.artist_display;
  if (art.date_display) attributes.Data = art.date_display;

  return {
    externalSource: 'artic',
    externalId: String(art.id),
    title: art.title || 'Sem título',
    imageUrl: art.image_id ? `${IIIF_URL}/${art.image_id}/full/843,/0/default.jpg` : null,
    attributes,
  };
}


async function fetchFromArtic(q: string): Promise<ExternalItem[]> {
  const url = new URL(ARTIC_SEARCH_URL);
  url.searchParams.set('q', q);
  url.searchParams.set('limit', '12');
  url.searchParams.set('fields', 'id,title,artist_display,date_display,image_id');

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
        'AIC-User-Agent': USER_AGENT,
      },
    });
    if (!res.ok) throw new Error(`Art Institute respondeu ${res.status}`);

    const json = (await res.json()) as { data?: ArticArtwork[] };
    return (json.data ?? []).map(toExternalItem);
  } catch (err) {
    console.error('Falha ao consultar o Art Institute:', err);
    throw externalUnavailable(
      'Não foi possível consultar o catálogo agora. Tente novamente em instantes.',
    );
  }
}


const cache = new Map<string, { items: ExternalItem[]; savedAt: number }>();

export async function searchArtworks(q: string): Promise<ExternalItem[]> {
  const key = q.trim().toLowerCase();
  const cached = cache.get(key);

  if (cached && Date.now() - cached.savedAt < CACHE_TTL_MS) {
    cache.delete(key);
    cache.set(key, cached);
    return cached.items;
  }

  try {
    const items = await fetchFromArtic(q.trim());

    cache.delete(key);
    if (cache.size >= CACHE_MAX_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(key, { items, savedAt: Date.now() });

    return items;
  } catch (err) {
    if (cached) return cached.items; 
    throw err; 
  }
}

// so p testar
export function resetSearchCacheForTests() {
  cache.clear();
}