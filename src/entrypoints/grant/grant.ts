import { originOf } from '../../core/site';

export function grantOriginFrom(search: string): string | null {
  const params = new URLSearchParams(search);
  const rawOrigin = params.get('origin');
  if (!rawOrigin) {
    return null;
  }
  const parsed = originOf(rawOrigin);
  if (parsed !== null && parsed === rawOrigin) {
    return parsed;
  }
  return null;
}

export async function requestGrant(
  origin: string,
  deps: {
    request(p: { origins: string[] }): Promise<boolean>;
    send(m: { type: 'po/granted'; origin: string }): Promise<unknown>;
  },
): Promise<'granted' | 'refused'> {
  try {
    const granted = await deps.request({ origins: [`${origin}/*`] });
    if (!granted) {
      return 'refused';
    }
    const reply = (await deps.send({ type: 'po/granted', origin })) as
      | { ok?: boolean }
      | undefined;
    if (reply && typeof reply === 'object' && reply.ok === true) {
      return 'granted';
    }
    return 'refused';
  } catch {
    return 'refused';
  }
}
