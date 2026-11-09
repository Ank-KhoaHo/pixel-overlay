import { IMAGE_KEY_PREFIX, SITE_KEY_PREFIX } from './types';

export function originOf(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

export function siteKey(origin: string): string {
  return `${SITE_KEY_PREFIX}${origin}`;
}

export function imageKey(imageId: string): string {
  return `${IMAGE_KEY_PREFIX}${imageId}`;
}
