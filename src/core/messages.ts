export type Message =
  | { type: 'po/toggle' }
  | { type: 'po/show' }
  | { type: 'po/ping' }
  | { type: 'po/keep'; origin: string; on: boolean }
  | { type: 'po/granted'; origin: string };

export function isMessage(x: unknown): x is Message {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) {
    return false;
  }
  const obj = x as Record<string, unknown>;
  if (
    obj.type === 'po/toggle' ||
    obj.type === 'po/show' ||
    obj.type === 'po/ping'
  ) {
    return true;
  }
  if (obj.type === 'po/keep') {
    return typeof obj.origin === 'string' && typeof obj.on === 'boolean';
  }
  if (obj.type === 'po/granted') {
    return typeof obj.origin === 'string';
  }
  return false;
}
