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

function testFakes(granted: string[] = []) {
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

describe('kept.test.ts - additional coverage', () => {
  it('unkeep on an origin not currently kept does nothing harmful', async () => {
    const f = testFakes(['https://example.com/*']);
    await unkeep(f.d, 'https://example.com');
    expect(await keptOrigins(f.d)).toEqual([]);
    expect(f.regs.has('po-kept')).toBe(false);
  });

  it('syncRegistration does nothing when neither kept origins nor registrations exist', async () => {
    const f = testFakes();
    await syncRegistration(f.d);
    expect(f.calls).toEqual([]);
    expect(f.regs.has('po-kept')).toBe(false);
  });

  it('syncRegistration handles permissions.contains throwing gracefully', async () => {
    const f = testFakes(['https://a.test/*']);
    f.d.permissions.contains = async () => {
      throw new Error('boom');
    };
    await keep(f.d, 'https://a.test');
    expect(f.regs.has('po-kept')).toBe(false);
  });

  it('keptOrigins returns empty array for null, undefined, or non-array values', async () => {
    const f = testFakes();
    expect(await keptOrigins(f.d)).toEqual([]);
    await f.d.area.set({ 'po.kept': null });
    expect(await keptOrigins(f.d)).toEqual([]);
    await f.d.area.set({ 'po.kept': { origin: 'https://test.com' } });
    expect(await keptOrigins(f.d)).toEqual([]);
  });

  it('syncRegistration calls update when matches list changes from [A] to [A, B]', async () => {
    const f = testFakes(['https://a.test/*', 'https://b.test/*']);
    await keep(f.d, 'https://a.test');
    expect(f.calls).toContain('register');
    f.calls.length = 0;
    await keep(f.d, 'https://b.test');
    expect(f.calls).toContain('update');
    expect(f.regs.get('po-kept')?.matches?.sort()).toEqual(['https://a.test/*', 'https://b.test/*'].sort());
  });
});
