import { describe, expect, it } from 'vitest';
import {
  adjacentMines,
  neighbors,
  placeMines,
  revealFrom,
  safeCellsRevealed,
  totalSafeCells,
  type RevealState
} from './board';

function state(width: number, height: number, mineList: number[]): RevealState {
  return {
    width,
    height,
    mines: new Set(mineList),
    revealed: new Map(),
    flags: new Map()
  };
}

describe('board generation', () => {
  it('places the requested number of unique mines inside the board', () => {
    const mines = placeMines(9, 9, 10, 12345, []);
    expect(mines.size).toBe(10);
    for (const mine of mines) {
      expect(mine).toBeGreaterThanOrEqual(0);
      expect(mine).toBeLessThan(81);
    }
  });

  it('never places a mine in the first-click safe zone', () => {
    const start = 40;
    const safe = new Set([start, ...neighbors(start, 9, 9)]);
    const mines = placeMines(9, 9, 10, 99, safe);
    for (const cell of safe) expect(mines.has(cell)).toBe(false);
  });

  it('is deterministic for a given seed', () => {
    const a = placeMines(16, 16, 40, 777, [0, 1, 2]);
    const b = placeMines(16, 16, 40, 777, [0, 1, 2]);
    expect([...a].sort((x, y) => x - y)).toEqual([...b].sort((x, y) => x - y));
  });

  it('refuses to place more mines than there are cells', () => {
    expect(() => placeMines(3, 3, 10, 1, [])).toThrow();
  });
});

describe('revealing', () => {
  it('floods through zeroes and stops at numbers', () => {
    const board = state(3, 3, [0]);
    const outcome = revealFrom(board, 8);
    expect(outcome.mineHits).toBe(0);
    expect(outcome.cells.find((cell) => cell.i === 8)?.n).toBe(0);
    expect(board.revealed.has(0)).toBe(false);
    expect(board.revealed.size).toBe(8);
    expect(safeCellsRevealed(board)).toBe(8);
    expect(totalSafeCells(3, 3, 1)).toBe(8);
  });

  it('counts adjacent mines correctly', () => {
    const board = state(3, 3, [0, 1]);
    expect(adjacentMines(4, 3, 3, board.mines)).toBe(2);
    expect(adjacentMines(8, 3, 3, board.mines)).toBe(0);
  });

  it('reveals a mine and reports exactly one hit', () => {
    const board = state(3, 3, [4]);
    const outcome = revealFrom(board, 4);
    expect(outcome.mineHits).toBe(1);
    expect(outcome.cells).toEqual([{ i: 4, n: -1 }]);
    expect(board.revealed.get(4)).toBe(-1);
  });

  it('does not reveal a flagged cell', () => {
    const board = state(3, 3, [0]);
    board.flags.set(8, 'player');
    const outcome = revealFrom(board, 8);
    expect(outcome.cells).toHaveLength(0);
  });

  it('does nothing for an already revealed cell', () => {
    const board = state(3, 3, [0]);
    revealFrom(board, 8);
    const outcome = revealFrom(board, 8);
    expect(outcome.cells).toHaveLength(0);
  });
});
