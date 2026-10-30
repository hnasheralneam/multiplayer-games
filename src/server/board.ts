import type { PublicCell } from '../shared/types';

export function toIndex(x: number, y: number, width: number): number {
  return y * width + x;
}

export function neighbors(i: number, width: number, height: number): number[] {
  const x = i % width;
  const y = Math.floor(i / width);
  const out: number[] = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      out.push(ny * width + nx);
    }
  }
  return out;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function placeMines(
  width: number,
  height: number,
  mines: number,
  seed: number,
  exclude: Iterable<number>
): Set<number> {
  const blocked = new Set(exclude);
  const candidates: number[] = [];
  for (let i = 0; i < width * height; i += 1) {
    if (!blocked.has(i)) candidates.push(i);
  }
  if (mines > candidates.length) {
    throw new Error('Too many mines for the board');
  }
  const random = mulberry32(seed);
  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  return new Set(candidates.slice(0, mines));
}

export function adjacentMines(
  i: number,
  width: number,
  height: number,
  mines: Set<number>
): number {
  let count = 0;
  for (const n of neighbors(i, width, height)) {
    if (mines.has(n)) count += 1;
  }
  return count;
}

export interface RevealState {
  width: number;
  height: number;
  mines: Set<number>;
  revealed: Map<number, number>;
  flags: Map<number, string>;
}

export interface RevealOutcome {
  cells: PublicCell[];
  mineHits: number;
}

export function revealFrom(state: RevealState, start: number): RevealOutcome {
  const { width, height, mines, revealed, flags } = state;
  if (start < 0 || start >= width * height) return { cells: [], mineHits: 0 };
  if (revealed.has(start) || flags.has(start)) return { cells: [], mineHits: 0 };

  if (mines.has(start)) {
    revealed.set(start, -1);
    return { cells: [{ i: start, n: -1 }], mineHits: 1 };
  }

  const cells: PublicCell[] = [];
  const stack = [start];
  const seen = new Set<number>();

  while (stack.length > 0) {
    const i = stack.pop() as number;
    if (seen.has(i)) continue;
    seen.add(i);
    if (revealed.has(i) || flags.has(i)) continue;
    if (mines.has(i)) continue;

    const n = adjacentMines(i, width, height, mines);
    revealed.set(i, n);
    cells.push({ i, n });

    if (n === 0) {
      for (const next of neighbors(i, width, height)) {
        if (!revealed.has(next) && !flags.has(next)) stack.push(next);
      }
    }
  }

  cells.sort((a, b) => a.i - b.i);
  return { cells, mineHits: 0 };
}

export function safeCellsRevealed(state: RevealState): number {
  let safe = 0;
  for (const [index] of state.revealed) {
    if (!state.mines.has(index)) safe += 1;
  }
  return safe;
}

export function totalSafeCells(width: number, height: number, mines: number): number {
  return width * height - mines;
}
