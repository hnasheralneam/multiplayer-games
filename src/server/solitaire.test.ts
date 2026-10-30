import { describe, expect, it } from 'vitest';
import { cardRank, cardSuit, type SolitaireSlot } from '../shared/types';
import {
  autoMove,
  dealSolitaire,
  drawStock,
  playMove,
  recycleWaste,
  solitaireWon,
  type SolitaireState
} from './solitaire';

function totalCards(state: SolitaireState): number {
  return (
    state.stock.length +
    state.waste.length +
    state.freeCells.filter((card) => card !== null).length +
    state.foundations.reduce((sum, pile) => sum + pile.length, 0) +
    state.tableau.reduce((sum, column) => sum + column.length, 0)
  );
}

function bareState(overrides: Partial<SolitaireState> = {}): SolitaireState {
  return {
    variant: 'klondike',
    draw: 1,
    stock: [],
    waste: [],
    foundations: [[], [], [], []],
    tableau: [[], [], [], [], [], [], []],
    faceDown: [0, 0, 0, 0, 0, 0, 0],
    freeCells: [],
    passes: 0,
    ...overrides
  };
}

describe('solitaire deals', () => {
  it('deals a complete Klondike table', () => {
    const state = dealSolitaire('klondike', 12345, 3);
    expect(state.tableau).toHaveLength(7);
    expect(state.tableau.map((column) => column.length)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(state.faceDown).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(state.stock).toHaveLength(24);
    expect(state.waste).toHaveLength(0);
    expect(state.draw).toBe(3);
    expect(totalCards(state)).toBe(52);
    expect(new Set([...state.stock, ...state.tableau.flat()]).size).toBe(52);
  });

  it('deals a complete face-up FreeCell table', () => {
    const state = dealSolitaire('freecell', 99);
    expect(state.tableau).toHaveLength(8);
    expect(state.tableau.map((column) => column.length)).toEqual([7, 7, 7, 7, 6, 6, 6, 6]);
    expect(state.faceDown.every((count) => count === 0)).toBe(true);
    expect(state.freeCells).toEqual([null, null, null, null]);
    expect(totalCards(state)).toBe(52);
  });

  it('draws and recycles the Klondike stock', () => {
    const state = dealSolitaire('klondike', 5, 3);
    expect(drawStock(state)).toBe(true);
    expect(state.waste).toHaveLength(3);
    expect(state.stock).toHaveLength(21);
    while (state.stock.length > 0) drawStock(state);
    expect(state.waste).toHaveLength(24);
    expect(drawStock(state)).toBe(false);
    expect(recycleWaste(state)).toBe(true);
    expect(state.stock).toHaveLength(24);
    expect(state.passes).toBe(1);
  });
});

describe('solitaire moves', () => {
  it('builds alternating colours in the tableau and sends aces home', () => {
    const state = bareState({
      tableau: [[24, 49], [51], [13], [], [], [], []]
    });
    const destination: SolitaireSlot = { zone: 'tableau', index: 1 };
    expect(playMove(state, 24, destination)).toBe(true);
    expect(state.tableau[0]).toEqual([]);
    expect(state.tableau[1]).toEqual([51, 24, 49]);
    expect(autoMove(state, 13)).toBe(true);
    expect(state.foundations[1]).toEqual([13]);
  });

  it('refuses an illegal colour or rank placement', () => {
    const state = bareState({ tableau: [[25], [24], [], [], [], [], []] });
    expect(playMove(state, 24, { zone: 'tableau', index: 0 })).toBe(false);
    expect(playMove(state, 25, { zone: 'tableau', index: 2 })).toBe(true);
  });

  it('flips the next card when a column is exposed', () => {
    const state = bareState({
      tableau: [[12, 24], [51], [], [], [], [], []],
      faceDown: [1, 0, 0, 0, 0, 0, 0]
    });
    expect(playMove(state, 24, { zone: 'tableau', index: 1 })).toBe(true);
    expect(state.tableau[0]).toEqual([12]);
    expect(state.faceDown[0]).toBe(0);
  });

  it('uses free cells and foundations in FreeCell', () => {
    const state = bareState({
      variant: 'freecell',
      tableau: [[51, 24], [13], [], [], [], [], [], []],
      faceDown: [0, 0, 0, 0, 0, 0, 0, 0],
      freeCells: [null, null, null, null]
    });
    expect(playMove(state, 24, { zone: 'freecell', index: 0 })).toBe(true);
    expect(state.freeCells[0]).toBe(24);
    expect(playMove(state, 13, { zone: 'foundation', index: 1 })).toBe(true);
    expect(state.foundations[1]).toEqual([13]);
    expect(cardSuit(24)).toBe('hearts');
    expect(cardRank(24)).toBe(12);
  });

  it('detects a finished table', () => {
    const state = bareState({
      foundations: [
        Array.from({ length: 13 }, (_, index) => index),
        Array.from({ length: 13 }, (_, index) => 13 + index),
        Array.from({ length: 13 }, (_, index) => 26 + index),
        Array.from({ length: 13 }, (_, index) => 39 + index)
      ]
    });
    expect(solitaireWon(state)).toBe(true);
    state.foundations[0].pop();
    expect(solitaireWon(state)).toBe(false);
  });
});
