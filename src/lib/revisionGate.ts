/**
 * Decides which store results the UI may show. Revisions only increase within
 * one store instance, and a new instance (after a retry, or after the
 * database was deleted and recreated) starts again from 1. So results are
 * compared only within the current instance, and anything from a previous
 * instance is ignored.
 */
export interface RevisionGate {
  /** A new store instance takes over; returns its epoch token. */
  begin(): number;
  /** The given instance closed or was replaced; its late results are ignored. */
  retire(epoch: number): void;
  /** True if a result from `epoch` at `rev` is current and should be shown. */
  accept(epoch: number, rev: number): boolean;
}

export function createRevisionGate(): RevisionGate {
  let current = 0;
  let lastRev = -Infinity;
  return {
    begin() {
      current += 1;
      lastRev = -Infinity;
      return current;
    },
    retire(epoch) {
      if (epoch !== current) return;
      current += 1;
      lastRev = -Infinity;
    },
    accept(epoch, rev) {
      if (epoch !== current || rev < lastRev) return false;
      lastRev = rev;
      return true;
    },
  };
}
