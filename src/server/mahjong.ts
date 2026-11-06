import {
  MAHJONG_LAYOUTS,
  hasFreeMatch,
  isTileFree,
  mahjongTileGroups,
  matchGroup,
  tilesMatch,
  type MahjongLayout
} from '../shared/mahjong';
import { mulberry32 } from './board';

export interface MahjongState {
  layout: MahjongLayout;
  /** One entry per layout position: tile type id, or -1 once removed. */
  tiles: number[];
  moves: number;
  shuffles: number;
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function groupIds(ids: number[]): number[][] {
  const groups = new Map<number, number[]>();
  for (const id of ids) {
    const group = matchGroup(id);
    const list = groups.get(group);
    if (list) list.push(id);
    else groups.set(group, [id]);
  }
  return [...groups.values()];
}

/**
 * Simulates pair removals over the occupied positions of a layout, recording
 * the order. Freeness depends only on which positions are occupied, so this
 * always terminates: the topmost, leftmost remaining tile always has an open
 * side and nothing above it. Forward play can clear the board in this order.
 */
function removalOrder(
  layout: MahjongLayout,
  slots: number[],
  random: () => number
): Array<[number, number]> | null {
  const occupied = new Array<number>(MAHJONG_LAYOUTS[layout].positions.length).fill(-1);
  for (const slot of slots) occupied[slot] = 1;
  const remaining = new Set(slots);
  const order: Array<[number, number]> = [];

  while (remaining.size >= 2) {
    const free: number[] = [];
    for (const slot of remaining) {
      if (isTileFree(layout, occupied, slot)) free.push(slot);
    }
    if (free.length < 2) return null;
    const i = Math.floor(random() * free.length);
    let j = Math.floor(random() * (free.length - 1));
    if (j >= i) j += 1;
    const [a, b] = [free[i], free[j]];
    occupied[a] = -1;
    occupied[b] = -1;
    remaining.delete(a);
    remaining.delete(b);
    order.push([a, b]);
  }
  return order;
}

/**
 * Splits tile ids into matching pairs (two ids from the same group each).
 * Groups always hold an even number of ids because play removes pairs.
 */
function tilePairs(layout: MahjongLayout, ids?: number[]): number[][] {
  const groups = ids ? groupIds(ids) : mahjongTileGroups(layout);
  const chunks: number[][] = [];
  for (const group of groups) {
    for (let i = 0; i + 1 < group.length; i += 2) {
      chunks.push([group[i], group[i + 1]]);
    }
  }
  return chunks;
}

function writeOrder(
  layout: MahjongLayout,
  order: Array<[number, number]>,
  chunks: number[][]
): number[] | null {
  if (chunks.length !== order.length) return null;
  const tiles = new Array<number>(MAHJONG_LAYOUTS[layout].positions.length).fill(-1);
  order.forEach(([a, b], index) => {
    const chunk = chunks[index];
    tiles[a] = chunk[0];
    tiles[b] = chunk[1];
  });
  return tiles;
}

function randomDeal(layout: MahjongLayout, random: () => number): number[] {
  return shuffled(mahjongTileGroups(layout).flat(), random);
}

/** Deals a guaranteed-solvable board (random deal as a last-resort fallback). */
export function dealMahjong(layout: MahjongLayout, seed: number): MahjongState {
  return dealMahjongTraced(layout, seed).state;
}

/** Same as dealMahjong but also returns the clearing order (for tests). */
export function dealMahjongTraced(
  layout: MahjongLayout,
  seed: number
): { state: MahjongState; order: Array<[number, number]> | null } {
  const random = mulberry32(seed);
  const slots = Array.from(
    { length: MAHJONG_LAYOUTS[layout].positions.length },
    (_, index) => index
  );
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const order = removalOrder(layout, slots, random);
    if (!order) continue;
    const tiles = writeOrder(layout, order, shuffled(tilePairs(layout), random));
    if (tiles) {
      return { state: { layout, tiles, moves: 0, shuffles: 0 }, order };
    }
  }
  return {
    state: { layout, tiles: randomDeal(layout, random), moves: 0, shuffles: 0 },
    order: null
  };
}

export function playMatch(state: MahjongState, a: number, b: number): boolean {
  const tiles = state.tiles;
  if (!Number.isInteger(a) || !Number.isInteger(b)) return false;
  if (a < 0 || b < 0 || a >= tiles.length || b >= tiles.length || a === b) return false;
  if (tiles[a] < 0 || tiles[b] < 0) return false;
  if (!isTileFree(state.layout, tiles, a) || !isTileFree(state.layout, tiles, b)) return false;
  if (!tilesMatch(tiles[a], tiles[b])) return false;
  tiles[a] = -1;
  tiles[b] = -1;
  return true;
}

/** Only offered when no matching free pair is left; re-deals the remaining tiles. */
export function shuffleRemaining(state: MahjongState, seed: number): boolean {
  return shuffleRemainingTraced(state, seed).ok;
}

/** Same as shuffleRemaining but also returns the clearing order (for tests). */
export function shuffleRemainingTraced(
  state: MahjongState,
  seed: number
): { ok: boolean; order: Array<[number, number]> | null } {
  if (hasFreeMatch(state.layout, state.tiles)) return { ok: false, order: null };
  const slots: number[] = [];
  const remaining: number[] = [];
  for (let i = 0; i < state.tiles.length; i += 1) {
    if (state.tiles[i] >= 0) {
      slots.push(i);
      remaining.push(state.tiles[i]);
    }
  }
  if (slots.length === 0) return { ok: false, order: null };

  const random = mulberry32(seed);
  const chunks = tilePairs(state.layout, remaining);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const order = removalOrder(state.layout, slots, random);
    if (!order) continue;
    const tiles = writeOrder(state.layout, order, shuffled(chunks, random));
    if (tiles) {
      state.tiles = tiles;
      state.shuffles += 1;
      return { ok: true, order };
    }
  }

  const pool = shuffled(remaining, random);
  const tiles = new Array<number>(state.tiles.length).fill(-1);
  slots.forEach((slot, index) => {
    tiles[slot] = pool[index];
  });
  state.tiles = tiles;
  state.shuffles += 1;
  return { ok: true, order: null };
}

export function mahjongStuck(state: MahjongState): boolean {
  return !mahjongWon(state) && !hasFreeMatch(state.layout, state.tiles);
}

export function mahjongWon(state: MahjongState): boolean {
  return state.tiles.every((tile) => tile < 0);
}
