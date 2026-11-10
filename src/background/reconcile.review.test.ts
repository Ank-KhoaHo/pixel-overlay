// Claude's review tests for ticket A3 (permission changes made outside the grant page).
// agy: never edit this file.
// Firefox lets the user grant or revoke a site from its own menus, and Chrome lets them revoke
// one in chrome://extensions. After a revoke, the kept list must forget that site, or the panel's
// Keep box stays ticked while nothing restores the layers.
import { describe, expect, it } from 'vitest';
import { createMemoryArea } from '../shared/storage';
import { keep, keptOrigins, reconcileKept, type KeptDeps } from './kept';

interface Reg {
  id: string;
  matches?: string[];
}

function fakes(granted: string[] = []) {
  const perms = new Set(granted);
  const regs = new Map<string, Reg>();
  const d: KeptDeps = {
    area: createMemoryArea(),
    permissions: {
      async contains(p) {
        return p.origins.every((o) => perms.has(o) || perms.has('<all_urls>'));
      },
      async remove(p) {
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
      },
      async updateContentScripts(list) {
        for (const r of list as Reg[]) regs.set(r.id, { ...regs.get(r.id)!, ...r });
      },
      async unregisterContentScripts(f) {
        f.ids.forEach((id) => regs.delete(id));
      },
    },
  };
  return { d, perms, regs };
}

const A = 'https://a.test';
const B = 'http://localhost:3000';

describe('reconcileKept', () => {
  it('forgets a kept site whose permission was revoked, and keeps the rest', async () => {
    const f = fakes([`${A}/*`, `${B}/*`]);
    await keep(f.d, A);
    await keep(f.d, B);
    f.perms.delete(`${A}/*`);
    await reconcileKept(f.d);
    expect(await keptOrigins(f.d)).toEqual([B]);
    expect(f.regs.get('po-kept')?.matches).toEqual([`${B}/*`]);
  });

  it('unregisters the script when the last kept site is revoked', async () => {
    const f = fakes([`${A}/*`]);
    await keep(f.d, A);
    f.perms.clear();
    await reconcileKept(f.d);
    expect(await keptOrigins(f.d)).toEqual([]);
    expect(f.regs.has('po-kept')).toBe(false);
  });

  it('changes nothing when every kept site still has its permission', async () => {
    const f = fakes([`${A}/*`, `${B}/*`]);
    await keep(f.d, A);
    await keep(f.d, B);
    await reconcileKept(f.d);
    expect(await keptOrigins(f.d)).toEqual([A, B]);
    expect(f.regs.get('po-kept')?.matches?.slice().sort()).toEqual([`${A}/*`, `${B}/*`].sort());
  });

  it('does not add a site the user granted without asking to keep it', async () => {
    const f = fakes([`${A}/*`, `${B}/*`]);
    await keep(f.d, A);
    await reconcileKept(f.d);
    expect(await keptOrigins(f.d)).toEqual([A]);
    expect(f.regs.get('po-kept')?.matches).toEqual([`${A}/*`]);
  });

  it('a kept site covered by <all_urls> stays kept', async () => {
    const f = fakes(['<all_urls>']);
    await keep(f.d, A);
    await reconcileKept(f.d);
    expect(await keptOrigins(f.d)).toEqual([A]);
  });

  it('a permission check that throws keeps the site: an error is not a revoke', async () => {
    const f = fakes([`${A}/*`, `${B}/*`]);
    await keep(f.d, A);
    await keep(f.d, B);
    const real = f.d.permissions.contains;
    f.d.permissions.contains = async (p) => {
      if (p.origins[0] === `${A}/*`) throw new Error('transient');
      return real(p);
    };
    await reconcileKept(f.d);
    expect(await keptOrigins(f.d)).toEqual([A, B]);
  });

  it('two overlapping calls with no registration yet both succeed (they are queued)', async () => {
    const f = fakes([`${A}/*`]);
    await f.d.area.set({ 'po.kept': [A, B] });
    // Unqueued, both calls would see no registration and both register: a duplicate-id error.
    await expect(Promise.all([reconcileKept(f.d), reconcileKept(f.d)])).resolves.toBeDefined();
    expect(await keptOrigins(f.d)).toEqual([A]);
    expect(f.regs.get('po-kept')?.matches).toEqual([`${A}/*`]);
  });

  it('two overlapping calls leave one consistent registration', async () => {
    const f = fakes([`${A}/*`, `${B}/*`]);
    await keep(f.d, A);
    await keep(f.d, B);
    f.perms.delete(`${B}/*`);
    await Promise.all([reconcileKept(f.d), reconcileKept(f.d)]);
    expect(await keptOrigins(f.d)).toEqual([A]);
    expect(f.regs.get('po-kept')?.matches).toEqual([`${A}/*`]);
  });
});
