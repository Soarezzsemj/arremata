import { API_URL } from './api';

export type ImageWidth = 200 | 400 | 843;

const IIIF_REGEX = /^https:\/\/www\.artic\.edu\/iiif\/2\/([^/]+)\//;

export function artImageUrl(imageUrl: string, width: ImageWidth): string {
  const match = IIIF_REGEX.exec(imageUrl);
  if (!match) return imageUrl;
  return `${API_URL}/images/${match[1]}?w=${width}`;
}
