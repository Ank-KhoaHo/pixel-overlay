// Claude's review tests for plan Task 6. agy: never edit this file.
import { describe, expect, it } from 'vitest';
import { createMemoryArea } from '../shared/storage';
import { keep, keptOrigins, syncRegistration, unkeep, type KeptDeps } from './kept';

interface Reg {
  id: string;
  matches?: string[];
  js?: string[];
  runAt?: string;
  persistAcrossSessions?: boolean;
}

function fakes(granted: string[] = []) {
  const perms = new Set(granted);
  const regs = new Map<string, Reg>();
  const calls: string[] = [];
  const d: KeptDeps = {
    area: createMemoryArea(),
    permissions: {
      async contains(p) {
        return p.origins.every((o) => perms.has(o));
      },
      async remove(p) {
        calls.push(`remove ${p.origins.join(',')}`);
        if (p.origins.some((o) => o === 'http://localhost/*')) throw new Error('required permission');
        p.origins.forEach((o) => perms.delete(o));
        return true;
      },
    },
    scripting: {
      async getRegisteredContentScripts(f) {
        const all = [...regs.values()];
        return f ? all.filter((r) => f.ids.includes(r.id)) : all;
      },
      async registerContentScripts(list) {
        for (const r of list as Reg[]) {
          if (regs.has(r.id)) throw new Error(`duplicate id ${r.id}`);
          regs.set(r.id, r);
        }
        calls.push('register');
      },
      async updateContentScripts(list) {
        for (const r of list as Reg[]) regs.set(r.id, { ...regs.get(r.id)!, ...r });
        calls.push('update');
      },
      async unregisterContentScripts(f) {
        f.ids.forEach((id) => regs.delete(id));
        calls.push('unregister');
      },
    },
  };
  return { d, perms, regs, calls };
}

const A = 'https://a.test';
const B = 'http://localhost:3000';

describe('keep / unkeep', () => {
  it('keep stores the origin once and registers po-kept for it', async () => {
    const f = fakes([`${A}/*`]);
    await keep(f.d, A);
    await keep(f.d, A);
    expect(await keptOrigins(f.d)).toEqual([A]);
    expect(await f.d.area.get('po.kept')).toEqual({ 'po.kept': [A] });
    const reg = f.regs.get('po-kept');
    expect(reg).toMatchObject({
      matches: [`${A}/*`],
      runAt: 'document_idle',
      persistAcrossSessions: true,
    });
    expect(reg?.js?.[0]).toMatch(/content-scripts\/overlay\.js$/);
  });

  it('a kept origin without permission is not registered', async () => {
    const f = fakes([]);
    await keep(f.d, A);
    expect(await keptOrigins(f.d)).toEqual([A]);
    expect(f.regs.has('po-kept')).toBe(false);
  });

  it('two kept origins share one registration', async () => {
    const f = fakes([`${A}/*`, `${B}/*`]);
    await keep(f.d, A);
    await keep(f.d, B);
    // Each origin gets its own port-specific match, never a wider one.
    expect(f.regs.get('po-kept')?.matches?.sort()).toEqual([`${A}/*`, `${B}/*`].sort());
  });

  it('unkeep drops the origin, removes its permission, and unregisters when none are left', async () => {
    const f = fakes([`${A}/*`]);
    await keep(f.d, A);
    await unkeep(f.d, A);
    expect(await keptOrigins(f.d)).toEqual([]);
    expect(f.perms.has(`${A}/*`)).toBe(false);
    expect(f.regs.has('po-kept')).toBe(false);
  });

  it('unkeep survives a permission that cannot be removed', async () => {
    const f = fakes([`${B}/*`, 'http://localhost/*']);
    await keep(f.d, B);
    await expect(unkeep(f.d, B)).resolves.toBeUndefined();
    expect(await keptOrigins(f.d)).toEqual([]);
    expect(f.regs.has('po-kept')).toBe(false);
  });

  it('unkeep of one origin keeps the other registered', async () => {
    const f = fakes([`${A}/*`, `${B}/*`]);
    await keep(f.d, A);
    await keep(f.d, B);
    await unkeep(f.d, A);
    expect(f.regs.get('po-kept')?.matches).toEqual([`${B}/*`]);
  });
});

describe('keptOrigins', () => {
  it('reads an empty list when nothing or garbage is stored', async () => {
    const f = fakes();
    expect(await keptOrigins(f.d)).toEqual([]);
    await f.d.area.set({ 'po.kept': 'nope' });
    expect(await keptOrigins(f.d)).toEqual([]);
    await f.d.area.set({ 'po.kept': [A, 5, null] });
    expect(await keptOrigins(f.d)).toEqual([A]);
  });
});

describe('syncRegistration', () => {
  it('is idempotent: a second sync with nothing changed makes no calls', async () => {
    const f = fakes([`${A}/*`]);
    await keep(f.d, A);
    f.calls.length = 0;
    await syncRegistration(f.d);
    expect(f.calls).toEqual([]);
  });

  it('drops an origin whose permission the user revoked in Chrome settings', async () => {
    const f = fakes([`${A}/*`, `${B}/*`]);
    await keep(f.d, A);
    await keep(f.d, B);
    f.perms.delete(`${A}/*`);
    await syncRegistration(f.d);
    expect(f.regs.get('po-kept')?.matches).toEqual([`${B}/*`]);
  });

  it('runs concurrent calls one after another (no duplicate-id error)', async () => {
    const f = fakes([`${A}/*`, `${B}/*`]);
    await f.d.area.set({ 'po.kept': [A, B] });
    await Promise.all([syncRegistration(f.d), syncRegistration(f.d), syncRegistration(f.d)]);
    expect(f.regs.get('po-kept')?.matches?.sort()).toEqual([`${A}/*`, `${B}/*`].sort());
  });
});
