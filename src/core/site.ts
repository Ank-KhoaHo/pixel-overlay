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

export function siteOf(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.origin;
    }
    if (parsed.protocol === 'file:') {
      parsed.search = '';
      parsed.hash = '';
      const href = parsed.href;
      const lastSlash = href.lastIndexOf('/');
      if (lastSlash === -1) {
        return href;
      }
      return href.slice(0, lastSlash + 1);
    }
    return null;
  } catch {
    return null;
  }
}

export function isKeepable(site: string): boolean {
  try {
    const parsed = new URL(site);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function needsFileAccessHelp(url: string | undefined, fileAccessAllowed: boolean): boolean {
  if (!url || fileAccessAllowed) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'file:';
  } catch {
    return false;
  }
}

export function siteKey(origin: string): string {
  return `${SITE_KEY_PREFIX}${origin}`;
}

export function imageKey(imageId: string): string {
  return `${IMAGE_KEY_PREFIX}${imageId}`;
}

