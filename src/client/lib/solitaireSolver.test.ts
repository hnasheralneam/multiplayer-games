import { describe, expect, it } from 'vitest';
import { dealSolitaire, type SolitaireState } from '../../server/solitaire';
import { solveSolitaire } from './solitaireSolver';
import { autoPlaySafe, playMove } from '../../shared/solitaire';
import type { SolitaireSlot } from '../../shared/types';

function bareState(overrides: Partial<SolitaireState> = {}): SolitaireState {
  return {
    variant: 'freecell',
    draw: 1,
    stock: [],
    waste: [],
    foundations: [[], [], [], []],
    tableau: [[], [], [], [], [], [], [], []],
    faceDown: [0, 0, 0, 0, 0, 0, 0, 0],
    freeCells: [null, null, null, null],
    passes: 0,
    ...overrides
  };
}

function cloneState(state: SolitaireState): SolitaireState {
  return {
    ...state,
    stock: state.stock.slice(),
    waste: state.waste.slice(),
    foundations: state.foundations.map((pile) => pile.slice()),
    tableau: state.tableau.map((column) => column.slice()),
    faceDown: state.faceDown.slice(),
    freeCells: state.freeCells.slice()
  };
}

function foundationRun(suitIndex: number, throughRank: number): number[] {
  return Array.from({ length: throughRank }, (_, index) => suitIndex * 13 + index);
}

/** Counts single-card moves the engine accepts (0 proves a position is stuck). */
function legalSingleMoves(state: SolitaireState): number {
  const cards = new Set<number>();
  for (const column of state.tableau) {
    const top = column[column.length - 1];
    if (top !== undefined) cards.add(top);
  }
  for (const cell of state.freeCells) {
    if (cell !== null) cards.add(cell);
  }
  const slots: SolitaireSlot[] = [];
  for (let index = 0; index < state.tableau.length; index += 1) {
    slots.push({ zone: 'tableau', index });
  }
  for (let index = 0; index < 4; index += 1) {
    slots.push({ zone: 'foundation', index });
    slots.push({ zone: 'freecell', index });
  }
  let count = 0;
  for (const card of cards) {
    for (const slot of slots) {
      if (playMove(cloneState(state), card, slot)) count += 1;
    }
  }
  return count;
}

describe('solveSolitaire', () => {
  it('solves a one-move-away FreeCell position', () => {
    const state = bareState({
      foundations: [
        foundationRun(0, 12),
        foundationRun(1, 12),
        foundationRun(2, 12),
        foundationRun(3, 12)
      ],
      tableau: [[12], [25], [38], [51]]
    });
    expect(solveSolitaire(state, { budgetMs: 4000 })).toBe('solvable');
  });

  it('solves a one-move-away Klondike position', () => {
    const state: SolitaireState = {
      ...bareState(),
      variant: 'klondike',
      foundations: [
        foundationRun(0, 12),
        foundationRun(1, 12),
        foundationRun(2, 12),
        foundationRun(3, 12)
      ],
      tableau: [[12], [25], [38], [51], [], [], []],
      faceDown: [0, 0, 0, 0, 0, 0, 0]
    };
    expect(solveSolitaire(state, { budgetMs: 4000 })).toBe('solvable');
  });

  it('proves a fully stuck FreeCell position unsolvable', () => {
    // Foundations hold A-10 of each suit; four lone kings top the columns;
    // black 4s/5s fill four more columns; the deuces fill the free cells.
    // Nothing can move anywhere and nothing can reach a foundation.
    const state = bareState({
      foundations: [
        foundationRun(0, 10),
        foundationRun(1, 10),
        foundationRun(2, 10),
        foundationRun(3, 10)
      ],
      tableau: [[12], [25], [38], [51], [3], [42], [4], [43]],
      freeCells: [14, 27, 1, 40]
    });
    expect(legalSingleMoves(state)).toBe(0);
    expect(autoPlaySafe(state)).toBe(false);
    expect(solveSolitaire(state, { budgetMs: 4000 })).toBe('unsolvable');
  });

  it('solves a freshly dealt FreeCell game', () => {
    const state = dealSolitaire('freecell', 12345);
    expect(solveSolitaire(state, { budgetMs: 9000, maxNodes: 900_000 })).toBe('solvable');
  });

  it('solves an early Klondike draw-1 position', () => {
    const state = dealSolitaire('klondike', 2, 1);
    expect(solveSolitaire(state, { budgetMs: 9000, maxNodes: 900_000 })).toBe('solvable');
  });
});
