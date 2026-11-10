// Claude's review tests for ticket A8 (align helpers). agy: never edit this file.
import { describe, expect, it } from 'vitest';
import { centerX, fitWidth, snap, SNAP_PX } from './align';
import { MAX_SCALE, MIN_SCALE } from './types';

describe('centerX', () => {
  it('centres the scaled layer in the page width', () => {
    expect(centerX({ naturalWidth: 400, scale: 1 }, 1000)).toBe(300);
    expect(centerX({ naturalWidth: 800, scale: 0.5 }, 1000)).toBe(300);
  });
  it('rounds to a whole pixel', () => {
    expect(Number.isInteger(centerX({ naturalWidth: 401, scale: 1 }, 1000))).toBe(true);
  });
  it('a layer wider than the page gets a negative x, still centred', () => {
    expect(centerX({ naturalWidth: 1200, scale: 1 }, 1000)).toBe(-100);
  });
});

describe('fitWidth', () => {
  it('scales the layer to the page width and moves it to x 0', () => {
    const r = fitWidth({ naturalWidth: 1440 }, 1280);
    expect(r.x).toBe(0);
    expect(r.scale).toBeCloseTo(1280 / 1440, 4);
    expect(Math.round(1440 * r.scale)).toBe(1280);
  });
  it('keeps at most 4 decimals, so the Scale field stays readable', () => {
    const r = fitWidth({ naturalWidth: 1440 }, 1280);
    expect(r.scale).toBe(0.8889);
  });
  it('stays inside the scale limits', () => {
    expect(fitWidth({ naturalWidth: 100 }, 1000).scale).toBe(MAX_SCALE);
    expect(fitWidth({ naturalWidth: 100000 }, 1000).scale).toBe(MIN_SCALE);
  });
});

describe('snap', () => {
  const vw = 1000;
  it('snaps x and y to 0 within SNAP_PX', () => {
    expect(SNAP_PX).toBe(8);
    expect(snap({ x: 5, y: 300, w: 400 }, vw)).toEqual({ x: 0, y: 300 });
    expect(snap({ x: -7, y: 3, w: 400 }, vw)).toEqual({ x: 0, y: 0 });
    expect(snap({ x: 8, y: -8, w: 400 }, vw)).toEqual({ x: 0, y: 0 });
  });
  it('does not snap from 9 px away', () => {
    expect(snap({ x: 9, y: 9, w: 400 }, vw)).toEqual({ x: 9, y: 9 });
  });
  it("snaps the layer's right edge to the page's right edge", () => {
    expect(snap({ x: 595, y: 100, w: 400 }, vw)).toEqual({ x: 600, y: 100 });
    expect(snap({ x: 606, y: 100, w: 400 }, vw)).toEqual({ x: 600, y: 100 });
  });
  it('a right-edge snap of a scaled layer lands on a whole pixel', () => {
    expect(snap({ x: 595, y: 100, w: 400.4 }, vw)).toEqual({ x: 600, y: 100 });
  });
  it('when both edges are in reach, the left edge wins', () => {
    expect(snap({ x: 4, y: 0, w: 1000 }, vw)).toEqual({ x: 0, y: 0 });
    expect(snap({ x: -4, y: 0, w: 1000 }, vw)).toEqual({ x: 0, y: 0 });
  });
});
