import type { MahjongLayout } from './mahjong';

export type { MahjongLayout };

export const CODE_ALPHABET = '23456789BCDFGHJKMNPQRSTVWXYZ';
export const CODE_LENGTH = 4;

export const MAX_PLAYERS = 8;
export const MIN_PLAYERS = 2;
export const AVATARS = ['🦦', '🐈', '🦊', '🐸', '🐙', '🦄', '🐝', '🦖'] as const;
export type Avatar = (typeof AVATARS)[number];

export const PLAYER_COLORS = [
  '#ff7a59',
  '#2dd4bf',
  '#818cf8',
  '#fbbf24',
  '#f472b6',
  '#4ade80',
  '#38bdf8',
  '#c084fc'
] as const;

export const PRESETS = {
  cozy: { label: 'Cozy', width: 9, height: 9, mines: 10, hint: 'A quick warm-up' },
  classic: { label: 'Classic', width: 16, height: 16, mines: 40, hint: 'The real thing' },
  big: { label: 'Big', width: 30, height: 16, mines: 99, hint: 'For a full table' }
} as const;

export type PresetId = keyof typeof PRESETS;
export const PRESET_IDS = Object.keys(PRESETS) as PresetId[];
export const LIVES_OPTIONS = [1, 2, 3, 5] as const;

export const SOLITAIRE_VARIANTS = ['klondike', 'freecell'] as const;
export type SolitaireVariant = (typeof SOLITAIRE_VARIANTS)[number];

export const GAME_KINDS = ['minesweeper', 'sudoku', 'klondike', 'freecell', 'mahjong'] as const;
export type GameKind = (typeof GAME_KINDS)[number];

export const GAME_META: Record<
  GameKind,
  { label: string; kicker: string; blurb: string; solo: boolean }
> = {
  minesweeper: {
    label: 'Minesweeper',
    kicker: 'Co-op',
    blurb: 'One shared minefield and two shared lives. Flag, chord, and clear it together.',
    solo: false
  },
  sudoku: {
    label: 'Sudoku',
    kicker: 'Co-op',
    blurb: 'One shared 9×9 grid. Wrong digits turn red and anyone can fix them.',
    solo: false
  },
  klondike: {
    label: 'Klondike',
    kicker: 'Solitaire',
    blurb: 'Classic draw-and-build solitaire. One table, everyone can move the cards.',
    solo: true
  },
  freecell: {
    label: 'FreeCell',
    kicker: 'Solitaire',
    blurb: 'Every card is face up and four cells are free. Plan the whole board.',
    solo: true
  },
  mahjong: {
    label: 'Mahjongg',
    kicker: 'Solitaire',
    blurb: 'One shared stack of tiles. Match free pairs and clear the board together.',
    solo: true
  }
};

export const GAME_ORDER: GameKind[] = [...GAME_KINDS];

export function isGameKind(value: string): value is GameKind {
  return (GAME_KINDS as readonly string[]).includes(value);
}

export function isSolitaireVariant(value: GameKind): value is SolitaireVariant {
  return (SOLITAIRE_VARIANTS as readonly string[]).includes(value);
}

export const KLONDIKE_DRAW_OPTIONS = [1, 3] as const;
export type KlondikeDraw = (typeof KLONDIKE_DRAW_OPTIONS)[number];

export function isKlondikeDraw(value: number): value is KlondikeDraw {
  return (KLONDIKE_DRAW_OPTIONS as readonly number[]).includes(value);
}

export const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'] as const;
export type Suit = (typeof SUITS)[number];

export const SUIT_SYMBOLS: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣'
};

export const RANK_LABELS = [
  '',
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K'
] as const;

export function cardSuitIndex(card: number): number {
  return Math.floor(card / 13);
}

export function cardSuit(card: number): Suit {
  return SUITS[cardSuitIndex(card)] ?? 'spades';
}

export function cardRank(card: number): number {
  return (card % 13) + 1;
}

export function isRedCard(card: number): boolean {
  const suit = cardSuit(card);
  return suit === 'hearts' || suit === 'diamonds';
}

export function cardLabel(card: number): string {
  return `${RANK_LABELS[cardRank(card)] ?? '?'}${SUIT_SYMBOLS[cardSuit(card)]}`;
}

export type SolitaireZone = 'tableau' | 'foundation' | 'freecell';

export interface SolitaireSlot {
  zone: SolitaireZone;
  index: number;
}

export const SUDOKU_DIFFICULTIES = {
  easy: { label: 'Easy', clues: 45 },
  medium: { label: 'Medium', clues: 36 },
  hard: { label: 'Hard', clues: 30 }
} as const;
export type SudokuDifficulty = keyof typeof SUDOKU_DIFFICULTIES;
export const SUDOKU_DIFFICULTY_IDS = Object.keys(SUDOKU_DIFFICULTIES) as SudokuDifficulty[];

export function isSudokuDifficulty(value: string): value is SudokuDifficulty {
  return (SUDOKU_DIFFICULTY_IDS as string[]).includes(value);
}

export function isPreset(value: string): value is PresetId {
  return (PRESET_IDS as string[]).includes(value);
}

export function isAvatar(value: string): value is Avatar {
  return (AVATARS as readonly string[]).includes(value);
}

export function normalizeCode(raw: string): string | null {
  const cleaned = raw.trim().toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (cleaned.length !== CODE_LENGTH) return null;
  for (const char of cleaned) {
    if (!CODE_ALPHABET.includes(char)) return null;
  }
  return cleaned;
}

export function extractCode(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const segment = url.pathname.split('/').filter(Boolean).pop() ?? '';
      return normalizeCode(segment);
    } catch {
      return null;
    }
  }
  return normalizeCode(trimmed);
}

export function codeIsValid(code: string): boolean {
  return normalizeCode(code) === code;
}

export interface RoomSettings {
  game: GameKind;
  preset: PresetId;
  width: number;
  height: number;
  mines: number;
  lives: number;
  maxPlayers: number;
  lateJoin: boolean;
  sudokuDifficulty: SudokuDifficulty;
  klondikeDraw: KlondikeDraw;
  mahjongLayout: MahjongLayout;
}

export type RoomStatus = 'lobby' | 'countdown' | 'playing' | 'results';

export interface PublicPlayer {
  id: string;
  name: string;
  avatar: Avatar;
  color: string;
  isHost: boolean;
  connected: boolean;
  joinedAt: number;
}

export interface PublicCell {
  i: number;
  n: number;
}

export interface PublicFlag {
  i: number;
  by: string;
}

export interface PublicRound {
  id: string;
  startedAt: number;
  endedAt?: number;
  width: number;
  height: number;
  mines: number;
  lives: number;
  revealed: PublicCell[];
  flags: PublicFlag[];
  firstClickDone: boolean;
}

export interface PlayerStats {
  playerId: string;
  name: string;
  avatar: Avatar;
  color: string;
  cells: number;
  flags: number;
  minesHit: number;
  share: number;
}

export interface RoundResult {
  game: 'minesweeper';
  result: 'won' | 'lost';
  endedAt: number;
  durationMs: number;
  livesLeft: number;
  startingLives: number;
  mines: number[];
  revealed: PublicCell[];
  flags: PublicFlag[];
  stats: PlayerStats[];
}

export interface PublicSudokuEntry {
  i: number;
  digit: number;
  by: string;
  wrong: boolean;
}

export interface PublicSudoku {
  id: string;
  startedAt: number;
  endedAt?: number;
  difficulty: SudokuDifficulty;
  givens: number[];
  entries: PublicSudokuEntry[];
}

export interface SudokuPlayerStats {
  playerId: string;
  name: string;
  avatar: Avatar;
  color: string;
  correct: number;
  wrong: number;
}

export interface SudokuResult {
  game: 'sudoku';
  result: 'won';
  endedAt: number;
  durationMs: number;
  difficulty: SudokuDifficulty;
  givens: number[];
  entries: PublicSudokuEntry[];
  solution: number[];
  stats: SudokuPlayerStats[];
}

export interface PublicSolitaire {
  id: string;
  startedAt: number;
  endedAt?: number;
  variant: SolitaireVariant;
  draw: KlondikeDraw;
  stock: number[];
  stockCount: number;
  waste: number[];
  foundations: number[][];
  tableau: number[][];
  faceDown: number[];
  freeCells: Array<number | null>;
  passes: number;
  moves: number;
}

export interface SolitairePlayerStats {
  playerId: string;
  name: string;
  avatar: Avatar;
  color: string;
  moves: number;
}

export interface SolitaireResult {
  game: SolitaireVariant;
  result: 'won';
  endedAt: number;
  durationMs: number;
  variant: SolitaireVariant;
  draw: KlondikeDraw;
  moves: number;
  passes: number;
  stats: SolitairePlayerStats[];
}

export interface PublicMahjong {
  id: string;
  startedAt: number;
  endedAt?: number;
  layout: MahjongLayout;
  /** One entry per layout position: tile type id, or -1 once removed. */
  tiles: number[];
  moves: number;
  shuffles: number;
}

export interface MahjongPlayerStats {
  playerId: string;
  name: string;
  avatar: Avatar;
  color: string;
  matches: number;
}

export interface MahjongResult {
  game: 'mahjong';
  result: 'won';
  endedAt: number;
  durationMs: number;
  layout: MahjongLayout;
  moves: number;
  shuffles: number;
  stats: MahjongPlayerStats[];
}

export type GameResult = RoundResult | SudokuResult | SolitaireResult | MahjongResult;

export interface PublicRoom {
  code: string;
  status: RoomStatus;
  hostId: string | null;
  settings: RoomSettings;
  players: PublicPlayer[];
  spectatorCount: number;
  createdAt: number;
  countdownEndsAt?: number;
  resultsEndsAt?: number;
  resumeAt?: number;
  paused?: boolean;
  pausedAt?: number;
  round?: PublicRound;
  sudoku?: PublicSudoku;
  solitaire?: PublicSolitaire;
  mahjong?: PublicMahjong;
  lastResult?: GameResult;
}

export interface You {
  id: string;
  name: string;
  avatar: Avatar;
  color: string;
  role: 'player' | 'spectator';
}

export type ErrorCode =
  | 'full'
  | 'not_found'
  | 'invalid_token'
  | 'settings_locked'
  | 'not_host'
  | 'bad_message'
  | 'rate_limited'
  | 'name_invalid'
  | 'replaced'
  | 'kicked'
  | 'closed'
  | 'resuming'
  | 'not_playing'
  | 'server_error';

export interface JoinMessage {
  t: 'join';
  code: string;
  name: string;
  avatar: Avatar;
  token?: string;
  spectate?: boolean;
}

export interface ProfileMessage {
  t: 'profile';
  name: string;
  avatar: Avatar;
}

export interface SettingsMessage {
  t: 'settings';
  game: GameKind;
  preset: PresetId;
  lives: number;
  maxPlayers: number;
  lateJoin: boolean;
  sudokuDifficulty: SudokuDifficulty;
  klondikeDraw: KlondikeDraw;
  mahjongLayout: MahjongLayout;
}

export interface StartMessage {
  t: 'start';
}

export interface RevealMessage {
  t: 'reveal';
  i: number;
}

export interface FlagMessageIn {
  t: 'flag';
  i: number;
}

export interface ChordMessage {
  t: 'chord';
  i: number;
}

export interface CursorMessageIn {
  t: 'cursor';
  x: number;
  y: number;
}

export interface LeaveMessage {
  t: 'leave';
}

export interface CloseRoomMessage {
  t: 'close';
}

export interface SudokuEntryMessage {
  t: 'sudoku';
  i: number;
  digit: number;
}

export interface SolitaireMessage {
  t: 'solitaire';
  action: 'draw' | 'recycle' | 'move' | 'auto';
  card?: number;
  to?: SolitaireSlot;
}

export interface MahjongMessage {
  t: 'mahjong';
  action: 'match' | 'shuffle';
  /** Position indexes into the layout's tile list. */
  a?: number;
  b?: number;
}

export interface ReturnLobbyMessage {
  t: 'lobby';
}

export type ClientMessage =
  | JoinMessage
  | ProfileMessage
  | SettingsMessage
  | StartMessage
  | RevealMessage
  | FlagMessageIn
  | ChordMessage
  | CursorMessageIn
  | LeaveMessage
  | CloseRoomMessage
  | SudokuEntryMessage
  | SolitaireMessage
  | MahjongMessage
  | ReturnLobbyMessage;

export interface WelcomeMessage {
  t: 'welcome';
  room: PublicRoom;
  you: You;
  token?: string;
  serverNow: number;
  notice?: string;
}

export interface RoomMessage {
  t: 'room';
  room: PublicRoom;
  serverNow: number;
}

export interface CellsMessage {
  t: 'cells';
  cells: PublicCell[];
  by: string;
}

export interface FlagMessageOut {
  t: 'flag';
  i: number;
  on: boolean;
  by: string;
}

export interface LifeMessage {
  t: 'life';
  lives: number;
  by: string;
  i: number;
}

export interface StaleMessage {
  t: 'stale';
  i: number;
}

export interface CursorMessageOut {
  t: 'cursor';
  id: string;
  x: number;
  y: number;
  name: string;
  color: string;
  avatar: Avatar;
  leave?: boolean;
}

export interface ErrorMessage {
  t: 'error';
  code: ErrorCode;
  message: string;
}

export interface SudokuCellMessage {
  t: 'sudokuCell';
  i: number;
  digit: number;
  by: string;
  wrong: boolean;
}

export interface ClosedMessage {
  t: 'closed';
  message: string;
}

export type ServerMessage =
  | WelcomeMessage
  | RoomMessage
  | CellsMessage
  | FlagMessageOut
  | LifeMessage
  | StaleMessage
  | CursorMessageOut
  | SudokuCellMessage
  | ErrorMessage
  | ClosedMessage;

export interface PreviewResponse {
  room: PublicRoom;
  serverNow: number;
  secureContextHint?: string;
}
