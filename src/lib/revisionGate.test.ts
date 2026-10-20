import { describe, expect, it } from 'vitest';
import { createRevisionGate } from './revisionGate';

describe('revision gate', () => {
  it('shows newer and same revisions from the current store, ignores older ones', () => {
    const gate = createRevisionGate();
    const e = gate.begin();
    expect(gate.accept(e, 3)).toBe(true);
    expect(gate.accept(e, 3)).toBe(true); // a re-read of the same revision
    expect(gate.accept(e, 5)).toBe(true);
    expect(gate.accept(e, 4)).toBe(false); // a slower, older result
  });

  it('a replacement store starting at revision 1 is shown even after the old one reached 100', () => {
    const gate = createRevisionGate();
    const old = gate.begin();
    expect(gate.accept(old, 100)).toBe(true);
    const next = gate.begin();
    expect(gate.accept(next, 1)).toBe(true);
    expect(gate.accept(next, 2)).toBe(true);
  });

  it('late results from a replaced store are ignored, whatever their revision', () => {
    const gate = createRevisionGate();
    const old = gate.begin();
    gate.accept(old, 7);
    const next = gate.begin();
    gate.accept(next, 1);
    expect(gate.accept(old, 8)).toBe(false);
    expect(gate.accept(old, 500)).toBe(false);
    expect(gate.accept(next, 2)).toBe(true);
  });

  it('a retired store is ignored even before a new one opens', () => {
    const gate = createRevisionGate();
    const e = gate.begin();
    gate.accept(e, 4);
    gate.retire(e);
    expect(gate.accept(e, 5)).toBe(false);
    const next = gate.begin();
    expect(gate.accept(next, 1)).toBe(true);
  });

  it('retiring an already-replaced store does not affect the current one', () => {
    const gate = createRevisionGate();
    const old = gate.begin();
    const next = gate.begin();
    gate.accept(next, 2);
    gate.retire(old);
    expect(gate.accept(next, 3)).toBe(true);
  });
});
