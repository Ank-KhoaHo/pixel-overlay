// Claude's review tests for ticket B1 item 10 (grant page logic). agy: never edit this file.
import { describe, expect, it } from 'vitest';
import { grantOriginFrom, requestGrant } from './grant';

describe('grantOriginFrom', () => {
  it('accepts an exact http(s) origin', () => {
    expect(grantOriginFrom('?origin=' + encodeURIComponent('http://localhost:3000'))).toBe('http://localhost:3000');
    expect(grantOriginFrom('?origin=' + encodeURIComponent('https://a.test'))).toBe('https://a.test');
  });

  it('refuses anything that is not exactly an origin', () => {
    for (const bad of [
      '',
      '?origin=',
      '?origin=' + encodeURIComponent('https://a.test/path'),
      '?origin=' + encodeURIComponent('https://a.test/'),
      '?origin=' + encodeURIComponent('chrome://extensions'),
      '?origin=' + encodeURIComponent('javascript:alert(1)'),
      '?origin=' + encodeURIComponent('<b>x</b>'),
    ]) {
      expect(grantOriginFrom(bad)).toBeNull();
    }
  });
});

describe('requestGrant', () => {
  it('asks for <origin>/* and reports granted only after the background answers ok', async () => {
    const asked: unknown[] = [];
    const sent: unknown[] = [];
    const r = await requestGrant('https://a.test', {
      request: async (p) => { asked.push(p); return true; },
      send: async (m) => { sent.push(m); return { ok: true }; },
    });
    expect(r).toBe('granted');
    expect(asked).toEqual([{ origins: ['https://a.test/*'] }]);
    expect(sent).toEqual([{ type: 'po/granted', origin: 'https://a.test' }]);
  });

  it('a refused prompt sends nothing', async () => {
    const sent: unknown[] = [];
    const r = await requestGrant('https://a.test', {
      request: async () => false,
      send: async (m) => { sent.push(m); return { ok: true }; },
    });
    expect(r).toBe('refused');
    expect(sent).toEqual([]);
  });

  it('a throwing prompt or a failed background reply is refused, never granted', async () => {
    expect(await requestGrant('https://a.test', {
      request: async () => { throw new Error('no gesture'); },
      send: async () => ({ ok: true }),
    })).toBe('refused');
    expect(await requestGrant('https://a.test', {
      request: async () => true,
      send: async () => ({ ok: false }),
    })).toBe('refused');
  });
});
