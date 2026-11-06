import { describe, expect, it } from 'vitest';
import {
  MAHJONG_LAYOUTS,
  isTileFree,
  mahjongTileGroups,
  tilesMatch
} from '../shared/mahjong';
import {
  dealMahjong,
  dealMahjongTraced,
  mahjongStuck,
  mahjongWon,
  playMatch,
  shuffleRemaining,
  shuffleRemainingTraced,
  type MahjongState
} from './mahjong';

const LAYOUTS = ['turtle', 'pyramid', 'cozy'] as const;

function tileMultiset(tiles: number[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const tile of tiles) {
    if (tile < 0) continue;
    counts.set(tile, (counts.get(tile) ?? 0) + 1);
  }
  return counts;
}

function groupsMatchMultiset(layout: (typeof LAYOUTS)[number], tiles: number[]): boolean {
  const remaining = tileMultiset(tiles);
  for (const group of mahjongTileGroups(layout)) {
    for (const id of group) {
      const count = remaining.get(id) ?? 0;
      if (count === 0) return false;
      if (count - 1 === 0) remaining.delete(id);
      else remaining.set(id, count - 1);
    }
  }
  return remaining.size === 0;
}

/**
 * Replays a clearing order through the real game rules. A legal replay proves
 * the board is solvable under the shared freeness rules.
 */
function replayClears(state: MahjongState, order: Array<[number, number]> | null): boolean {
  if (!order) return false;
  for (const [a, b] of order) {
    if (!playMatch(state, a, b)) return false;
  }
  return mahjongWon(state);
}

describe('mahjong deals', () => {
  it('fills every layout with the full tile set', () => {
    for (const layout of LAYOUTS) {
      const expected = MAHJONG_LAYOUTS[layout].positions.length;
      const state = dealMahjong(layout, 4242);
      expect(state.tiles).toHaveLength(expected);
      expect(state.tiles.filter((tile) => tile >= 0)).toHaveLength(expected);
      expect(groupsMatchMultiset(layout, state.tiles)).toBe(true);
      expect(state.moves).toBe(0);
      expect(state.shuffles).toBe(0);
    }
  });

  it('deals deterministically from a seed', () => {
    const a = dealMahjong('turtle', 7);
    const b = dealMahjong('turtle', 7);
    expect(b.tiles).toEqual(a.tiles);
    const c = dealMahjong('turtle', 8);
    expect(c.tiles).not.toEqual(a.tiles);
  });

  it('dealt boards clear in the construction order under game rules', () => {
    for (const layout of LAYOUTS) {
      for (let seed = 1; seed <= 12; seed += 1) {
        const traced = dealMahjongTraced(layout, seed * 1013);
        expect(traced.order).not.toBeNull();
        expect(traced.order!.length * 2).toBe(traced.state.tiles.length);
        expect(replayClears(traced.state, traced.order)).toBe(true);
      }
    }
  });

  it('uses the reduced tile set on the cozy layout', () => {
    const state = dealMahjong('cozy', 5);
    const allowed = [0, 1, 2, 3, 4, 5, 9, 10, 11, 12, 13, 14, 18, 19, 20, 21, 22, 23];
    for (const tile of state.tiles) {
      expect(allowed).toContain(tile);
    }
  });
});

describe('mahjong moves', () => {
  it('rejects blocked, removed, and non-matching tiles', () => {
    const state = dealMahjong('pyramid', 99);

    const buried = state.tiles.findIndex(
      (tile, index) =>
        tile >= 0 &&
        MAHJONG_LAYOUTS.pyramid.positions[index].l === 0 &&
        !isTileFree('pyramid', state.tiles, index)
    );
    expect(buried).toBeGreaterThanOrEqual(0);
    const anyFree = state.tiles.findIndex(
      (tile, index) => tile >= 0 && isTileFree('pyramid', state.tiles, index)
    );
    expect(anyFree).toBeGreaterThanOrEqual(0);

    expect(playMatch(state, buried, anyFree)).toBe(false);
    expect(playMatch(state, buried, buried)).toBe(false);
    expect(playMatch(state, -1, anyFree)).toBe(false);
    expect(playMatch(state, 9999, anyFree)).toBe(false);

    // Two free tiles from different groups do not match.
    const free = state.tiles
      .map((tile, index) => ({ tile, index }))
      .filter(({ tile, index }) => tile >= 0 && isTileFree('pyramid', state.tiles, index));
    const a = free[0];
    const b = free.find((other) => !tilesMatch(a.tile, other.tile));
    if (b) {
      expect(playMatch(state, a.index, b.index)).toBe(false);
      expect(state.tiles[a.index]).toBe(a.tile);
      expect(state.tiles[b.index]).toBe(b.tile);
    }
  });

  it('matches a free pair', () => {
    const state = dealMahjong('cozy', 11);
    const free = state.tiles
      .map((tile, index) => ({ tile, index }))
      .filter(({ tile, index }) => tile >= 0 && isTileFree('cozy', state.tiles, index));
    const a = free.find((first) =>
      free.some((other) => other.index !== first.index && tilesMatch(first.tile, other.tile))
    )!;
    const b = free.find((other) => other.index !== a.index && tilesMatch(a.tile, other.tile))!;
    const left = state.tiles.filter((tile) => tile >= 0).length;
    expect(playMatch(state, a.index, b.index)).toBe(true);
    expect(state.tiles[a.index]).toBe(-1);
    expect(state.tiles[b.index]).toBe(-1);
    expect(state.tiles.filter((tile) => tile >= 0).length).toBe(left - 2);
    expect(mahjongWon(state)).toBe(false);
  });

  it('wins when the last pair is removed', () => {
    const traced = dealMahjongTraced('cozy', 3);
    expect(replayClears(traced.state, traced.order)).toBe(true);
    expect(mahjongWon(traced.state)).toBe(true);
    expect(mahjongStuck(traced.state)).toBe(false);
  });
});

describe('mahjong shuffle', () => {
  it('refuses while a free match exists', () => {
    const state = dealMahjong('cozy', 21);
    expect(mahjongStuck(state)).toBe(false);
    const snapshot = [...state.tiles];
    expect(shuffleRemaining(state, 5)).toBe(false);
    expect(state.tiles).toEqual(snapshot);
    expect(state.shuffles).toBe(0);
  });

  /**
   * A legal stuck board: four tiles of two groups in one row. The two outer
   * tiles are free but from different groups; the inner two are blocked on
   * both sides. Group counts stay even, so play could reach this state.
   */
  function stuckRow(seed: number): MahjongState {
    const state = dealMahjong('cozy', seed);
    const groups = mahjongTileGroups('cozy');
    const g1 = groups[0][0];
    const g2 = groups[1][0];
    state.tiles = state.tiles.map(() => -1);
    state.tiles[0] = g1;
    state.tiles[1] = g1;
    state.tiles[2] = g2;
    state.tiles[3] = g2;
    expect(mahjongStuck(state)).toBe(true);
    return state;
  }

  it('reshuffles a stuck board in place and resolves the deadlock', () => {
    const state = stuckRow(31);
    const before = tileMultiset(state.tiles);
    const traced = shuffleRemainingTraced(state, 77);
    expect(traced.ok).toBe(true);
    expect(state.shuffles).toBe(1);
    expect(tileMultiset(state.tiles)).toEqual(before);
    expect(state.tiles.filter((tile) => tile >= 0)).toHaveLength(4);
    expect(mahjongStuck(state)).toBe(false);
    expect(replayClears(state, traced.order)).toBe(true);
  });

  it('never loses or duplicates tiles when reshuffled', () => {
    for (const seed of [41, 43, 47]) {
      const state = stuckRow(seed);
      const before = tileMultiset(state.tiles);
      expect(shuffleRemaining(state, seed)).toBe(true);
      expect(tileMultiset(state.tiles)).toEqual(before);
    }
  });
});
