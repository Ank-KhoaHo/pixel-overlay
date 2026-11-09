export function shadowModeFor(mode: string): ShadowRootMode {
  return mode === 'e2e' ? 'open' : 'closed';
}
