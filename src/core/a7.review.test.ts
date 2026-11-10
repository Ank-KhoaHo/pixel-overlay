// Claude's review tests for ticket A7 (keyboard shortcuts). agy: never edit this file.
import { describe, expect, it } from 'vitest';
import { applyCommand, COMMANDS } from './commands';
import { isMessage } from './messages';
import { addLayer, emptySiteState, setBlend, updateLayer } from './state';
import type { SiteState } from './types';

function withLayer(opacity = 0.5): SiteState {
  let s = addLayer(emptySiteState(), {
    id: 'L1', name: 'a', imageId: 'I1', naturalWidth: 10, naturalHeight: 10,
  });
  s = updateLayer(s, 'L1', { opacity });
  return s;
}
const op = (s: SiteState) => s.layers[0]!.opacity;

describe('applyCommand', () => {
  it('lists the four page commands', () => {
    expect([...COMMANDS].sort()).toEqual(
      ['opacity-down', 'opacity-up', 'toggle-difference', 'toggle-hide-all'].sort(),
    );
  });

  it('opacity-up adds 10 % to the active layer, and stops at 100 %', () => {
    expect(op(applyCommand(withLayer(0.5), 'opacity-up'))).toBe(0.6);
    expect(op(applyCommand(withLayer(0.95), 'opacity-up'))).toBe(1);
  });

  it('opacity-down takes 10 % off, stops at 0, and leaves no float dust', () => {
    expect(op(applyCommand(withLayer(0.7), 'opacity-down'))).toBe(0.6);
    expect(op(applyCommand(withLayer(0.05), 'opacity-down'))).toBe(0);
    let s = withLayer(0.3);
    for (let i = 0; i < 3; i++) s = applyCommand(s, 'opacity-up');
    expect(op(s)).toBe(0.6);
    // 0.2 + 0.1 is 0.30000000000000004 in floating point; the command must round it away.
    expect(op(applyCommand(withLayer(0.2), 'opacity-up'))).toBe(0.3);
  });

  it('opacity works on a locked layer too (lock only stops moving)', () => {
    const s = updateLayer(withLayer(0.5), 'L1', { locked: true });
    expect(op(applyCommand(s, 'opacity-up'))).toBe(0.6);
  });

  it('with no active layer, opacity commands change nothing', () => {
    const s = { ...withLayer(0.5), activeLayerId: null };
    expect(applyCommand(s, 'opacity-up')).toBe(s);
  });

  it('toggle-hide-all flips Hide all, and does nothing with no layers', () => {
    const s = withLayer();
    const hidden = applyCommand(s, 'toggle-hide-all');
    expect(hidden.allHidden).toBe(true);
    expect(applyCommand(hidden, 'toggle-hide-all').allHidden).toBe(false);
    const empty = emptySiteState();
    expect(applyCommand(empty, 'toggle-hide-all')).toBe(empty);
  });

  it('toggle-difference acts like the Difference button', () => {
    const s = withLayer();
    expect(applyCommand(s, 'toggle-difference').blend).toBe('difference');
    expect(applyCommand(setBlend(s, 'difference'), 'toggle-difference').blend).toBe('normal');
    expect(applyCommand(setBlend(s, 'multiply'), 'toggle-difference').blend).toBe('difference');
  });

  it('an unknown command changes nothing', () => {
    const s = withLayer();
    expect(applyCommand(s, 'delete-everything' as never)).toBe(s);
  });
});

describe('po/command message', () => {
  it('accepts the known command names only', () => {
    expect(isMessage({ type: 'po/command', name: 'opacity-up' })).toBe(true);
    expect(isMessage({ type: 'po/command', name: 'toggle-hide-all' })).toBe(true);
    expect(isMessage({ type: 'po/command', name: '_execute_action' })).toBe(false);
    expect(isMessage({ type: 'po/command', name: 'whatever' })).toBe(false);
    expect(isMessage({ type: 'po/command' })).toBe(false);
  });
});
