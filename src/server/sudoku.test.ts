import { describe, expect, it } from 'vitest';
import { SUDOKU_DIFFICULTY_IDS } from '../shared/types';
import { countSolutions, generateSudoku, isSudokuSolved } from './sudoku';

describe('sudoku', () => {
  it('generates unique solvable grids at every difficulty', () => {
    for (const difficulty of SUDOKU_DIFFICULTY_IDS) {
      const puzzle = generateSudoku(difficulty, 12345);
      expect(puzzle.givens).toHaveLength(81);
      expect(puzzle.solution).toHaveLength(81);
      expect(puzzle.givens.filter(Boolean).length).toBeGreaterThanOrEqual(28);
      expect(countSolutions(puzzle.givens, 2).count).toBe(1);
      for (let i = 0; i < 81; i += 1) {
        if (puzzle.givens[i]) expect(puzzle.givens[i]).toBe(puzzle.solution[i]);
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
