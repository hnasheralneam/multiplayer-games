import { describe, expect, it } from 'vitest';
import {
  autoPlaySafe,
  isSafeAutoMove,
  type SolitaireState
} from './solitaire';

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

function foundationRun(suitIndex: number, throughRank: number): number[] {
  return Array.from({ length: throughRank }, (_, index) => suitIndex * 13 + index);
}

// Card ints: suitIndex * 13 + (rank - 1). spades 0, hearts 1, diamonds 2, clubs 3.
describe('isSafeAutoMove', () => {
  it('always sends aces and twos up', () => {
    const state = bareState({
      tableau: [[0], [14], [15], [], [], [], [], []],
      foundations: [[], [13], [], []]
    });
    expect(isSafeAutoMove(state, 0)).toBe(true); // A♠
    expect(isSafeAutoMove(state, 14)).toBe(true); // 2♥ with A♥ already home
    expect(isSafeAutoMove(state, 15)).toBe(false); // 3♥ needs its foundation at 2
  });

  it('holds a five until both opposite foundations reach four and the other black reaches three', () => {
    // 5♠ in a free cell with A-4♠ already home; hearts/diamonds/clubs vary.
    const state = bareState({
      freeCells: [4, null, null, null],
      foundations: [
        foundationRun(0, 4),
        foundationRun(1, 4),
        foundationRun(2, 4),
        foundationRun(3, 3)
      ]
    });
    expect(isSafeAutoMove(state, 4)).toBe(true);

    expect(
      isSafeAutoMove(
        bareState({
          freeCells: [4, null, null, null],
          foundations: [
            foundationRun(0, 4),
            foundationRun(1, 3),
            foundationRun(2, 4),
            foundationRun(3, 3)
          ]
        }),
        4
      )
    ).toBe(false);

    expect(
      isSafeAutoMove(
        bareState({
          freeCells: [4, null, null, null],
          foundations: [
            foundationRun(0, 4),
            foundationRun(1, 4),
            foundationRun(2, 4),
            foundationRun(3, 2)
          ]
        }),
        4
      )
    ).toBe(false);
  });

  it('refuses cards that are not legal foundation plays at all', () => {
    const state = bareState({ tableau: [[4], [], [], [], [], [], [], []] });
    expect(isSafeAutoMove(state, 4)).toBe(false);
  });
});

describe('autoPlaySafe', () => {
  it('sweeps every safe card home and is idempotent', () => {
    const state = bareState({
      tableau: [[0], [13], [26], [39], [], [], [], []],
      freeCells: [1, 14, null, null]
    });
    expect(autoPlaySafe(state)).toBe(true);
    expect(state.foundations.map((pile) => pile.length)).toEqual([2, 2, 1, 1]);
    expect(state.foundations[0]).toEqual([0, 1]);
    expect(state.foundations[1]).toEqual([13, 14]);
    expect(state.freeCells.every((cell) => cell === null)).toBe(true);
    expect(autoPlaySafe(state)).toBe(false);
  });

  it('leaves unsafe cards in place', () => {
    const state = bareState({ tableau: [[4], [], [], [], [], [], [], []] });
    expect(autoPlaySafe(state)).toBe(false);
    expect(state.tableau[0]).toEqual([4]);
    expect(state.foundations.every((pile) => pile.length === 0)).toBe(true);
  });

  it('sweeps the Klondike waste top after a draw', () => {
    const state: SolitaireState = {
      variant: 'klondike',
      draw: 1,
      stock: [],
      waste: [13],
      foundations: [[], [], [], []],
      tableau: [[], [], [], [], [], [], []],
      faceDown: [0, 0, 0, 0, 0, 0, 0],
      freeCells: [],
      passes: 0
    };
    expect(autoPlaySafe(state)).toBe(true);
    expect(state.waste).toEqual([]);
    expect(state.foundations[1]).toEqual([13]);
  });
});
