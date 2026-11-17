import { describe, expect, it } from 'vitest';
import { SUDOKU_DIFFICULTIES, SUDOKU_DIFFICULTY_IDS } from '../types';
import { countSolutions, generateSudoku, isSudokuSolved } from './sudoku';

describe('sudoku', () => {
  it('generates unique solvable grids at every difficulty', () => {
    for (const difficulty of SUDOKU_DIFFICULTY_IDS) {
      const puzzle = generateSudoku(difficulty, 12345);
      expect(puzzle.givens).toHaveLength(81);
      expect(puzzle.solution).toHaveLength(81);
      expect(puzzle.givens.filter(Boolean).length).toBeGreaterThanOrEqual(
        SUDOKU_DIFFICULTIES[difficulty].clues
      );
      expect(countSolutions(puzzle.givens, 2).count).toBe(1);
      for (let i = 0; i < 81; i += 1) {
        if (puzzle.givens[i]) expect(puzzle.givens[i]).toBe(puzzle.solution[i]);
      }
    }
  });

  it('keeps at least one clue in every row, column, and box', () => {
    for (const difficulty of SUDOKU_DIFFICULTY_IDS) {
      for (const seed of [12345, 987, 424242, 31337]) {
        const { givens } = generateSudoku(difficulty, seed);
        const rows = new Array(9).fill(0);
        const cols = new Array(9).fill(0);
        const boxes = new Array(9).fill(0);
        for (let i = 0; i < 81; i += 1) {
          if (!givens[i]) continue;
          const row = Math.floor(i / 9);
          const col = i % 9;
          rows[row] += 1;
          cols[col] += 1;
          boxes[Math.floor(row / 3) * 3 + Math.floor(col / 3)] += 1;
        }
        expect([rows, cols, boxes].flat().every((count) => count > 0)).toBe(true);
      }
    }
  });

  it('recognises a completed grid', () => {
    const puzzle = generateSudoku('easy', 7);
    const entries = new Map(
      puzzle.solution.map((digit, i) => [i, { digit }] as const)
    );
    expect(isSudokuSolved(puzzle.givens, entries, puzzle.solution)).toBe(true);
    entries.set(0, { digit: (puzzle.solution[0] % 9) + 1 });
    expect(isSudokuSolved(puzzle.givens, entries, puzzle.solution)).toBe(false);
  });
});
