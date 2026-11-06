export type MahjongFamily =
  | 'circle'
  | 'bamboo'
  | 'character'
  | 'wind'
  | 'dragon'
  | 'flower'
  | 'season';

export interface MahjongTilePos {
  x: number;
  y: number;
  l: number;
}

export interface MahjongLayoutDef {
  label: string;
  hint: string;
  tileSet: 'full' | 'low';
  positions: MahjongTilePos[];
}

export type MahjongLayout = 'turtle' | 'pyramid' | 'cozy';

const CHARACTER_DIGITS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const CHARACTER_SUIT = '萬';
export const WIND_GLYPHS = ['東', '南', '西', '北'];
export const DRAGON_GLYPHS = ['中', '發', '白'];
export const FLOWER_GLYPHS = ['梅', '蘭', '菊', '竹'];
export const SEASON_GLYPHS = ['春', '夏', '秋', '冬'];

const WIND_NAMES = ['East wind', 'South wind', 'West wind', 'North wind'];
const DRAGON_NAMES = ['Red dragon', 'Green dragon', 'White dragon'];
const FLOWER_NAMES = ['Plum blossom', 'Orchid', 'Chrysanthemum', 'Bamboo'];
const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'];

/**
 * Tile type ids:
 *   0–8   circles 1–9      9–17  bamboo 1–9      18–26 characters 1–9
 *   27–30 winds            31–33 dragons
 *   34–37 flowers (unique tiles, match any other flower)
 *   38–41 seasons (unique tiles, match any other season)
 */
export function tileFamily(type: number): MahjongFamily {
  if (type < 9) return 'circle';
  if (type < 18) return 'bamboo';
  if (type < 27) return 'character';
  if (type < 31) return 'wind';
  if (type < 34) return 'dragon';
  if (type < 38) return 'flower';
  return 'season';
}

export function tileLabel(type: number): string {
  if (type < 27) {
    const rank = (type % 9) + 1;
    const family = tileFamily(type);
    const name = family === 'circle' ? 'Circle' : family === 'bamboo' ? 'Bamboo' : 'Character';
    return `${name} ${rank}`;
  }
  if (type < 31) return WIND_NAMES[type - 27];
  if (type < 34) return DRAGON_NAMES[type - 31];
  if (type < 38) return `${FLOWER_NAMES[type - 34]} flower`;
  return `${SEASON_NAMES[type - 38]} season`;
}

/** Glyph for the tile face; circles and bamboo render pip patterns instead. */
export function tileGlyph(type: number): string {
  if (type < 18) return '';
  if (type < 27) return CHARACTER_DIGITS[type - 18];
  if (type < 31) return WIND_GLYPHS[type - 27];
  if (type < 34) return DRAGON_GLYPHS[type - 31];
  if (type < 38) return FLOWER_GLYPHS[type - 34];
  return SEASON_GLYPHS[type - 38];
}

/** Tiles match when they share a type, or are both flowers / both seasons. */
export function matchGroup(type: number): number {
  if (type <= 33) return type;
  return type <= 37 ? 34 : 38;
}

export function tilesMatch(a: number, b: number): boolean {
  return matchGroup(a) === matchGroup(b);
}

function grid(
  cols: number,
  rows: number,
  offsetX: number,
  offsetY: number,
  layer: number,
  exclude?: (col: number, row: number) => boolean
): MahjongTilePos[] {
  const out: MahjongTilePos[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (exclude && exclude(col, row)) continue;
      out.push({ x: offsetX * 2 + col * 2, y: offsetY * 2 + row * 2, l: layer });
    }
  }
  return out;
}

export const MAHJONG_LAYOUTS: Record<MahjongLayout, MahjongLayoutDef> = {
  turtle: {
    label: 'Turtle',
    hint: 'The classic 144-tile stack',
    tileSet: 'full',
    positions: [
      ...grid(12, 8, 0, 0, 0, (col, row) => col >= 8 && col <= 10 && row >= 3 && row <= 5),
      ...grid(6, 6, 2, 1, 1),
      ...grid(4, 4, 3, 2, 2),
      ...grid(2, 2, 4, 3, 3),
      ...grid(1, 1, 4, 3, 4)
    ]
  },
  pyramid: {
    label: 'Pyramid',
    hint: '144 tiles in three clean steps',
    tileSet: 'full',
    positions: [
      ...grid(12, 8, 0, 0, 0),
      ...grid(8, 4, 2, 2, 1),
      ...grid(4, 4, 4, 2, 2)
    ]
  },
  cozy: {
    label: 'Cozy',
    hint: 'A quick 72-tile board',
    tileSet: 'low',
    positions: [...grid(9, 6, 0, 0, 0), ...grid(6, 3, 1, 1, 1)]
  }
};

export const MAHJONG_LAYOUT_IDS = Object.keys(MAHJONG_LAYOUTS) as MahjongLayout[];

export function isMahjongLayout(value: string): value is MahjongLayout {
  return (MAHJONG_LAYOUT_IDS as string[]).includes(value);
}

export function mahjongTileTotal(layout: MahjongLayout): number {
  return MAHJONG_LAYOUTS[layout].positions.length;
}

export function mahjongTileCols(layout: MahjongLayout): number {
  let max = 0;
  for (const pos of MAHJONG_LAYOUTS[layout].positions) max = Math.max(max, pos.x);
  return (max + 2) / 2;
}

export function mahjongTileRows(layout: MahjongLayout): number {
  let max = 0;
  for (const pos of MAHJONG_LAYOUTS[layout].positions) max = Math.max(max, pos.y);
  return (max + 2) / 2;
}

export function mahjongTileLayers(layout: MahjongLayout): number {
  let max = 0;
  for (const pos of MAHJONG_LAYOUTS[layout].positions) max = Math.max(max, pos.l);
  return max + 1;
}

/**
 * Tile type groups dealt for a layout. Every group holds exactly four tile ids
 * that all match each other (flowers/seasons are four unique ids in one group).
 */
export function mahjongTileGroups(layout: MahjongLayout): number[][] {
  const tileSet = MAHJONG_LAYOUTS[layout].tileSet;
  const groups: number[][] = [];
  if (tileSet === 'full') {
    for (let type = 0; type < 34; type += 1) groups.push([type, type, type, type]);
    groups.push([34, 35, 36, 37]);
    groups.push([38, 39, 40, 41]);
  } else {
    // Ranks 1–6 of each suit: circles 0–5, bamboo 9–14, characters 18–23.
    for (const type of [0, 1, 2, 3, 4, 5, 9, 10, 11, 12, 13, 14, 18, 19, 20, 21, 22, 23]) {
      groups.push([type, type, type, type]);
    }
  }
  return groups;
}

interface LayoutGraph {
  above: number[][];
  left: number[][];
  right: number[][];
}

const graphs = new Map<MahjongLayout, LayoutGraph>();

function layoutGraph(layout: MahjongLayout): LayoutGraph {
  const cached = graphs.get(layout);
  if (cached) return cached;
  const positions = MAHJONG_LAYOUTS[layout].positions;
  const above: number[][] = positions.map(() => []);
  const left: number[][] = positions.map(() => []);
  const right: number[][] = positions.map(() => []);
  for (let i = 0; i < positions.length; i += 1) {
    for (let j = 0; j < positions.length; j += 1) {
      if (i === j) continue;
      const a = positions[i];
      const b = positions[j];
      if (b.l > a.l && Math.abs(b.x - a.x) < 2 && Math.abs(b.y - a.y) < 2) {
        above[i].push(j);
        continue;
      }
      if (b.l === a.l && b.y > a.y - 2 && b.y < a.y + 2) {
        if (b.x === a.x - 2) left[i].push(j);
        if (b.x === a.x + 2) right[i].push(j);
      }
    }
  }
  const graph = { above, left, right };
  graphs.set(layout, graph);
  return graph;
}

/** A tile is free when nothing rests on it and its left or right edge is open. */
export function isTileFree(layout: MahjongLayout, tiles: number[], index: number): boolean {
  if (index < 0 || index >= tiles.length || tiles[index] < 0) return false;
  const graph = layoutGraph(layout);
  for (const j of graph.above[index]) {
    if (tiles[j] >= 0) return false;
  }
  let leftBlocked = false;
  for (const j of graph.left[index]) {
    if (tiles[j] >= 0) {
      leftBlocked = true;
      break;
    }
  }
  if (!leftBlocked) return true;
  for (const j of graph.right[index]) {
    if (tiles[j] >= 0) return false;
  }
  return true;
}

export function freeTileIndices(layout: MahjongLayout, tiles: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < tiles.length; i += 1) {
    if (tiles[i] >= 0 && isTileFree(layout, tiles, i)) out.push(i);
  }
  return out;
}

export function hasFreeMatch(layout: MahjongLayout, tiles: number[]): boolean {
  const free = freeTileIndices(layout, tiles);
  for (let a = 0; a < free.length; a += 1) {
    for (let b = a + 1; b < free.length; b += 1) {
      if (tilesMatch(tiles[free[a]], tiles[free[b]])) return true;
    }
  }
  return false;
}

export function mahjongTilesLeft(tiles: number[]): number {
  let count = 0;
  for (const tile of tiles) {
    if (tile >= 0) count += 1;
  }
  return count;
}
