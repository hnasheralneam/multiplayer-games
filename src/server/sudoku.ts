import { randomInt } from 'node:crypto';
import { SUDOKU_DIFFICULTIES, type SudokuDifficulty } from '../shared/types';
import { mulberry32 } from './board';

export interface SudokuPuzzle {
  difficulty: SudokuDifficulty;
  givens: number[];
  solution: number[];
}

function shuffleInPlace<T>(items: T[], random: () => number): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function popcount(value: number): number {
  let count = 0;
  let v = value;
  while (v) {
    v &= v - 1;
    count += 1;
  }
  return count;
}

function fullSolution(random: () => number): number[] {
  const digits = shuffleInPlace([1, 2, 3, 4, 5, 6, 7, 8, 9], random);
  const bands = shuffleInPlace([0, 1, 2], random);
  const stacks = shuffleInPlace([0, 1, 2], random);
  const rowOrder = bands.flatMap((band) =>
    shuffleInPlace([0, 1, 2], random).map((row) => band * 3 + row)
  );
  const colOrder = stacks.flatMap((stack) =>
    shuffleInPlace([0, 1, 2], random).map((col) => stack * 3 + col)
  );
  const grid = new Array<number>(81).fill(0);
  for (let r = 0; r < 9; r += 1) {
    for (let c = 0; c < 9; c += 1) {
      const pattern = (rowOrder[r] * 3 + Math.floor(rowOrder[r] / 3) + colOrder[c]) % 9;
      grid[r * 9 + c] = digits[pattern];
    }
  }
  return grid;
}

export function countSolutions(
  grid: number[],
  limit = 2
): { count: number; solution: number[] | null } {
  const work = grid.slice();
  const rowMasks = new Array<number>(9).fill(0);
  const colMasks = new Array<number>(9).fill(0);
  const boxMasks = new Array<number>(9).fill(0);

  for (let i = 0; i < 81; i += 1) {
    const digit = work[i];
    if (!digit) continue;
    const bit = 1 << digit;
    const r = Math.floor(i / 9);
    const c = i % 9;
    const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
    if (rowMasks[r] & bit || colMasks[c] & bit || boxMasks[b] & bit) {
      return { count: 0, solution: null };
    }
    rowMasks[r] |= bit;
    colMasks[c] |= bit;
    boxMasks[b] |= bit;
  }

  let count = 0;
  let solution: number[] | null = null;

  const search = (): boolean => {
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let i = 0; i < 81; i += 1) {
      if (work[i] !== 0) continue;
      const r = Math.floor(i / 9);
      const c = i % 9;
      const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
      const used = rowMasks[r] | colMasks[c] | boxMasks[b];
      const mask = ~used & 0x3fe;
      if (mask === 0) return false;
      const options = popcount(mask);
      if (options < bestCount) {
        best = i;
        bestMask = mask;
        bestCount = options;
        if (options === 1) break;
      }
    }

    if (best === -1) {
      count += 1;
      if (!solution) solution = work.slice();
      return count >= limit;
    }

    const r = Math.floor(best / 9);
    const c = best % 9;
    const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
    let mask = bestMask;
    while (mask) {
      const bit = mask & -mask;
      const digit = 31 - Math.clz32(bit);
      work[best] = digit;
      rowMasks[r] |= bit;
      colMasks[c] |= bit;
      boxMasks[b] |= bit;
      const done = search();
      work[best] = 0;
      rowMasks[r] ^= bit;
      colMasks[c] ^= bit;
      boxMasks[b] ^= bit;
      if (done) return true;
      mask ^= bit;
    }
    return false;
  };

  search();
  return { count, solution };
}

export function generateSudoku(
  difficulty: SudokuDifficulty,
  seed = randomInt(0, 2 ** 31 - 1)
): SudokuPuzzle {
  const random = mulberry32(seed);
  const solution = fullSolution(random);
  const puzzle = solution.slice();
  const targetClues = SUDOKU_DIFFICULTIES[difficulty].clues;
  const indices = shuffleInPlace([...Array(81).keys()], random);
  let clues = 81;

  for (const index of indices) {
    if (clues <= targetClues) break;
    const backup = puzzle[index];
    puzzle[index] = 0;
    const unique = countSolutions(puzzle, 2).count === 1;
    if (unique) {
      clues -= 1;
    } else {
      puzzle[index] = backup;
    }
  }

  return { difficulty, givens: puzzle, solution };
}

export function isSudokuSolved(
  givens: number[],
  entries: Map<number, { digit: number }>,
  solution: number[]
): boolean {
  for (let i = 0; i < 81; i += 1) {
    const value = givens[i] || entries.get(i)?.digit || 0;
    if (value !== solution[i]) return false;
  }
  return true;
}
