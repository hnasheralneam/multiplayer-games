import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';
import type { Client } from './client';
import {
  AVATARS,
  GAME_KINDS,
  KLONDIKE_DRAW_OPTIONS,
  LIVES_OPTIONS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PLAYER_COLORS,
  PRESETS,
  SUDOKU_DIFFICULTY_IDS,
  isSolitaireVariant,
  type Avatar,
  type ClientMessage,
  type ErrorCode,
  type GameKind,
  type GameResult,
  type JoinMessage,
  type MahjongPlayerStats,
  type MahjongResult,
  type PlayerStats,
  type PublicCell,
  type PublicFlag,
  type PublicMahjong,
  type PublicRoom,
  type PublicRound,
  type PublicSolitaire,
  type PublicSudoku,
  type PublicSudokuEntry,
  type RoomSettings,
  type RoomStatus,
  type RoundResult,
  type ServerMessage,
  type SolitairePlayerStats,
  type SolitaireResult,
  type SudokuDifficulty,
  type SudokuPlayerStats,
  type SudokuResult,
  type You
} from '../shared/types';
import { randomName } from '../shared/names';
import { isMahjongLayout, isTileFree } from '../shared/mahjong';
import {
  neighbors,
  placeMines,
  revealFrom,
  safeCellsRevealed,
  totalSafeCells
} from './board';
import { generateSudoku, isSudokuSolved } from './sudoku';
import {
  autoMove,
  autoPlaySafe,
  dealSolitaire,
  drawStock,
  playMove,
  recycleWaste,
  solitaireWon,
  type SolitaireState
} from './solitaire';
import {
  dealMahjong,
  mahjongWon,
  playMatch,
  shuffleRemaining,
  type MahjongState
} from './mahjong';

const HOST_MIGRATION_MS = 60_000;
const LOBBY_SEAT_TTL_MS = 90_000;
const PLAYING_SEAT_TTL_MS = 5 * 60_000;
const COUNTDOWN_MS = 3_000;
const RESUME_MS = 2_000;
const ACTION_COOLDOWN_MS = 55;
const CURSOR_COOLDOWN_MS = 25;
const SELECT_COOLDOWN_MS = 35;
const ROOM_TTL_MS = 24 * 60 * 60_000;
const RESULTS_RETURN_MS = 12_000;
const SUDOKU_ACTION_COOLDOWN_MS = 35;

interface Player {
  id: string;
  name: string;
  avatar: Avatar;
  color: string;
  tokenHash: string;
  client: Client | null;
  connected: boolean;
  joinedAt: number;
  removeAt?: number;
  lastActionAt: number;
  lastCursorAt: number;
  lastSelectAt: number;
}

interface RoundStats {
  cells: number;
  minesHit: number;
}

interface SudokuStats {
  correct: number;
  wrong: number;
}

interface SudokuRound {
  id: string;
  startedAt: number;
  endedAt?: number;
  difficulty: SudokuDifficulty;
  givens: number[];
  solution: number[];
  entries: Map<number, { digit: number; by: string; wrong: boolean }>;
  stats: Map<string, SudokuStats>;
}

interface SolitaireRound {
  id: string;
  startedAt: number;
  endedAt?: number;
  state: SolitaireState;
  moves: number;
  stats: Map<string, number>;
}

interface MahjongRound {
  id: string;
  startedAt: number;
  endedAt?: number;
  state: MahjongState;
  moves: number;
  stats: Map<string, number>;
  selections: Map<string, number>;
}

interface Round {
  id: string;
  seed: number;
  startedAt: number;
  endedAt?: number;
  width: number;
  height: number;
  mines: number;
  lives: number;
  startingLives: number;
  minesSet: Set<number> | null;
  revealed: Map<number, number>;
  flags: Map<number, string>;
  firstClickDone: boolean;
  stats: Map<string, RoundStats>;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function newToken(): string {
  return randomBytes(24).toString('base64url');
}

export function defaultSettings(): RoomSettings {
  const preset = PRESETS.classic;
  return {
    game: 'minesweeper',
    preset: 'classic',
    width: preset.width,
    height: preset.height,
    mines: preset.mines,
    lives: 2,
    maxPlayers: 8,
    lateJoin: true,
    sudokuDifficulty: 'medium',
    klondikeDraw: 1,
    mahjongLayout: 'turtle'
  };
}

export function sanitizeName(raw: string): string {
  return raw
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[<>&]/g, '')
    .replace(/[^\p{L}\p{N} '._-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16);
}

export class Room {
  readonly code: string;
  readonly createdAt: number;
  settings: RoomSettings;
  status: RoomStatus = 'lobby';
  hostId: string | null = null;
  players = new Map<string, Player>();
  spectators = new Map<string, Client>();
  round: Round | null = null;
  sudoku: SudokuRound | null = null;
  solitaire: SolitaireRound | null = null;
  mahjong: MahjongRound | null = null;
  lastResult: GameResult | null = null;
  countdownEndsAt?: number;
  resultsEndsAt?: number;
  resumeAt?: number;
  pausedAt?: number;
  lastActivity: number;

  private pendingHostHash: string | null;
  private hostTimer?: ReturnType<typeof setTimeout>;
  private countdownTimer?: ReturnType<typeof setTimeout>;
  private resultsTimer?: ReturnType<typeof setTimeout>;
  private onDestroy: (code: string) => void;
  private destroyed = false;

  constructor(
    code: string,
    settings: RoomSettings,
    pendingHostHash: string | null,
    onDestroy: (code: string) => void
  ) {
    this.code = code;
    this.settings = settings;
    this.pendingHostHash = pendingHostHash;
    this.onDestroy = onDestroy;
    this.createdAt = Date.now();
    this.lastActivity = this.createdAt;
  }

  private touch(): void {
    this.lastActivity = Date.now();
  }

  connectedPlayers(): number {
    let count = 0;
    for (const player of this.players.values()) {
      if (player.connected) count += 1;
    }
    return count;
  }

  private sortedPlayers(): Player[] {
    return [...this.players.values()].sort((a, b) => a.joinedAt - b.joinedAt);
  }

  private hostPlayer(): Player | undefined {
    return this.hostId ? this.players.get(this.hostId) : undefined;
  }

  private playerFor(client: Client): Player | undefined {
    return client.playerId ? this.players.get(client.playerId) : undefined;
  }

  private isHost(client: Client): boolean {
    return Boolean(client.playerId && client.playerId === this.hostId);
  }

  toPublic(): PublicRoom {
    const players = this.sortedPlayers().map((player) => ({
      id: player.id,
      name: player.name,
      avatar: player.avatar,
      color: player.color,
      isHost: player.id === this.hostId,
      connected: player.connected,
      joinedAt: player.joinedAt
    }));

    let round: PublicRound | undefined;
    if (this.round) {
      const revealed: PublicCell[] = [...this.round.revealed.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([i, n]) => ({ i, n }));
      const flags: PublicFlag[] = [...this.round.flags.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([i, by]) => ({ i, by }));
      round = {
        id: this.round.id,
        startedAt: this.round.startedAt,
        endedAt: this.round.endedAt,
        width: this.round.width,
        height: this.round.height,
        mines: this.round.mines,
        lives: this.round.lives,
        revealed,
        flags,
        firstClickDone: this.round.firstClickDone
      };
    }

    let sudoku: PublicSudoku | undefined;
    if (this.sudoku) {
      const entries: PublicSudokuEntry[] = [...this.sudoku.entries.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([i, entry]) => ({ i, digit: entry.digit, by: entry.by, wrong: entry.wrong }));
      sudoku = {
        id: this.sudoku.id,
        startedAt: this.sudoku.startedAt,
        endedAt: this.sudoku.endedAt,
        difficulty: this.sudoku.difficulty,
        givens: this.sudoku.givens,
        entries
      };
    }

    let solitaire: PublicSolitaire | undefined;
    if (this.solitaire) {
      const state = this.solitaire.state;
      solitaire = {
        id: this.solitaire.id,
        startedAt: this.solitaire.startedAt,
        endedAt: this.solitaire.endedAt,
        variant: state.variant,
        draw: state.draw,
        stock: [...state.stock],
        stockCount: state.stock.length,
        waste: [...state.waste],
        foundations: state.foundations.map((pile) => [...pile]),
        tableau: state.tableau.map((column) => [...column]),
        faceDown: [...state.faceDown],
        freeCells: [...state.freeCells],
        passes: state.passes,
        moves: this.solitaire.moves
      };
    }

    let mahjong: PublicMahjong | undefined;
    if (this.mahjong) {
      mahjong = {
        id: this.mahjong.id,
        startedAt: this.mahjong.startedAt,
        endedAt: this.mahjong.endedAt,
        layout: this.mahjong.state.layout,
        tiles: [...this.mahjong.state.tiles],
        moves: this.mahjong.moves,
        shuffles: this.mahjong.state.shuffles,
        selections: [...this.mahjong.selections.entries()]
          .sort((a, b) => a[1] - b[1])
          .map(([by, i]) => ({ by, i }))
      };
    }

    return {
      code: this.code,
      status: this.status,
      hostId: this.hostId,
      settings: this.settings,
      players,
      spectatorCount: this.spectators.size,
      createdAt: this.createdAt,
      countdownEndsAt: this.countdownEndsAt,
      resultsEndsAt: this.resultsEndsAt,
      resumeAt: this.resumeAt,
      paused: Boolean(this.pausedAt),
      pausedAt: this.pausedAt,
      round,
      sudoku,
      solitaire,
      mahjong,
      lastResult: this.lastResult ?? undefined
    };
  }

  private send(client: Client, message: ServerMessage): void {
    client.send(message);
  }

  private error(client: Client, code: ErrorCode, message: string): void {
    this.send(client, { t: 'error', code, message });
  }

  private broadcast(message: ServerMessage, except?: Client): void {
    for (const player of this.players.values()) {
      if (player.client && player.client !== except) player.client.send(message);
    }
    for (const spectator of this.spectators.values()) {
      if (spectator !== except) spectator.send(message);
    }
  }

  private broadcastRoom(except?: Client): void {
    this.broadcast({ t: 'room', room: this.toPublic(), serverNow: Date.now() }, except);
  }

  private sendWelcome(client: Client, player: Player | null, token?: string, notice?: string): void {
    const you: You = player
      ? {
          id: player.id,
          name: player.name,
          avatar: player.avatar,
          color: player.color,
          role: 'player'
        }
      : {
          id: client.id,
          name: 'Watcher',
          avatar: AVATARS[0],
          color: '#8b95a7',
          role: 'spectator'
        };
    client.send({
      t: 'welcome',
      room: this.toPublic(),
      you,
      token,
      serverNow: Date.now(),
      notice
    });
  }

  private uniqueName(raw: string, exceptId?: string): string {
    const base = sanitizeName(raw) || randomName();
    const taken = new Set(
      [...this.players.values()]
        .filter((player) => player.id !== exceptId)
        .map((player) => player.name.toLowerCase())
    );
    if (!taken.has(base.toLowerCase())) return base;
    for (let n = 2; n < 100; n += 1) {
      const suffix = ` ${n}`;
      const candidate = `${base.slice(0, 16 - suffix.length)}${suffix}`;
      if (!taken.has(candidate.toLowerCase())) return candidate;
    }
    return base.slice(0, 12) + randomInt(10, 99);
  }

  private colorForSeat(): string {
    const used = new Set([...this.players.values()].map((player) => player.color));
    return PLAYER_COLORS.find((color) => !used.has(color)) ?? PLAYER_COLORS[this.players.size % PLAYER_COLORS.length];
  }

  handleJoin(client: Client, message: JoinMessage): void {
    if (client.roomCode && client.roomCode !== this.code) {
      this.error(client, 'server_error', 'You are already in another room.');
      return;
    }

    const token = message.token?.trim() || null;
    const tokenHash = token ? hashToken(token) : null;
    const existing = tokenHash
      ? [...this.players.values()].find((player) => player.tokenHash === tokenHash)
      : undefined;

    if (existing) {
      if (existing.client && existing.client.id !== client.id) {
        existing.client.send({
          t: 'error',
          code: 'replaced',
          message: 'You opened this room in another tab.'
        });
        existing.client.close(4001, 'replaced');
      }
      client.roomCode = this.code;
      client.playerId = existing.id;
      client.role = 'player';
      this.spectators.delete(client.id);
      existing.client = client;
      existing.connected = true;
      existing.removeAt = undefined;

      if (this.pendingHostHash && tokenHash === this.pendingHostHash) {
        this.hostId = existing.id;
        this.pendingHostHash = null;
      }
      if (this.hostId === existing.id) {
        if (this.hostTimer) clearTimeout(this.hostTimer);
        this.hostTimer = undefined;
      }

      this.resumeIfPaused();
      this.sendWelcome(client, existing);
      this.broadcastRoom(client);
      this.touch();
      return;
    }

    if (message.spectate) {
      this.addSpectator(client);
      return;
    }

    if (this.status === 'playing' && !this.settings.lateJoin) {
      this.addSpectator(client, 'This round is already going. You are watching.');
      return;
    }

    if (this.players.size >= this.settings.maxPlayers) {
      this.error(client, 'full', `This room is full (${this.settings.maxPlayers}/${this.settings.maxPlayers}).`);
      return;
    }

    if (this.hostId && !this.players.has(this.hostId)) {
      this.hostId = null;
    }

    const isPendingHost = Boolean(
      token && tokenHash && this.pendingHostHash && tokenHash === this.pendingHostHash
    );
    const playerToken = isPendingHost && token ? token : newToken();
    const playerTokenHash = isPendingHost && tokenHash ? tokenHash : hashToken(playerToken);
    const player: Player = {
      id: randomUUID(),
      name: this.uniqueName(message.name ?? ''),
      avatar: (message.avatar && (AVATARS as readonly string[]).includes(message.avatar)
        ? message.avatar
        : AVATARS[randomInt(0, AVATARS.length)]) as Avatar,
      color: this.colorForSeat(),
      tokenHash: playerTokenHash,
      client,
      connected: true,
      joinedAt: Date.now(),
      lastActionAt: 0,
      lastCursorAt: 0,
      lastSelectAt: 0
    };

    this.players.set(player.id, player);
    this.spectators.delete(client.id);
    client.roomCode = this.code;
    client.playerId = player.id;
    client.role = 'player';

    if (!this.hostId) {
      if (isPendingHost && this.pendingHostHash === playerTokenHash) {
        this.hostId = player.id;
        this.pendingHostHash = null;
      } else if (!this.pendingHostHash) {
        this.hostId = player.id;
      }
    }

    if (this.round && this.status === 'playing') {
      this.round.stats.set(player.id, { cells: 0, minesHit: 0 });
    } else if (this.sudoku && this.status === 'playing') {
      this.sudoku.stats.set(player.id, { correct: 0, wrong: 0 });
    } else if (this.solitaire && this.status === 'playing') {
      this.solitaire.stats.set(player.id, 0);
    } else if (this.mahjong && this.status === 'playing') {
      this.mahjong.stats.set(player.id, 0);
    }

    this.resumeIfPaused();
    this.sendWelcome(client, player, playerToken);
    this.broadcastRoom(client);
    this.touch();
  }

  private addSpectator(client: Client, notice?: string): void {
    this.spectators.set(client.id, client);
    client.roomCode = this.code;
    client.playerId = undefined;
    client.role = 'spectator';
    this.sendWelcome(client, null, undefined, notice);
    this.broadcastRoom(client);
    this.touch();
  }

  handleMessage(client: Client, message: ClientMessage): void {
    if (message.t === 'join') {
      this.handleJoin(client, message);
      return;
    }
    if (message.t === 'leave') {
      this.handleLeave(client);
      return;
    }
    if (client.roomCode !== this.code) {
      this.error(client, 'server_error', 'Join a room first.');
      return;
    }
    if (message.t === 'cursor') {
      this.handleCursor(client, message.x, message.y);
      return;
    }
    if (client.role !== 'player') {
      this.error(client, 'not_playing', 'Spectators cannot do that.');
      return;
    }
    switch (message.t) {
      case 'profile':
        this.handleProfile(client, message.name, message.avatar);
        break;
      case 'settings':
        this.handleSettings(client, message);
        break;
      case 'start':
        this.handleStart(client);
        break;
      case 'reveal':
        this.handleReveal(client, message.i);
        break;
      case 'flag':
        this.handleFlag(client, message.i);
        break;
      case 'chord':
        this.handleChord(client, message.i);
        break;
      case 'sudoku':
        this.handleSudokuEntry(client, message.i, message.digit);
        break;
      case 'solitaire':
        this.handleSolitaireAction(client, message);
        break;
      case 'mahjong':
        this.handleMahjongAction(client, message);
        break;
      case 'lobby':
        this.handleReturnLobby(client);
        break;
      case 'close':
        this.handleClose(client);
        break;
      default:
        break;
    }
  }

  private handleProfile(client: Client, name: string, avatar: string): void {
    const player = this.playerFor(client);
    if (!player) return;
    if (this.status !== 'lobby' && this.status !== 'results') {
      this.error(client, 'settings_locked', 'Names can change between rounds.');
      return;
    }
    const clean = this.uniqueName(name, player.id);
    player.name = clean;
    if ((AVATARS as readonly string[]).includes(avatar)) player.avatar = avatar as Avatar;
    this.touch();
    this.broadcastRoom();
  }

  private handleSettings(client: Client, message: Extract<ClientMessage, { t: 'settings' }>): void {
    if (!this.isHost(client)) {
      this.error(client, 'not_host', 'Only the host can change the board.');
      return;
    }
    if (this.status !== 'lobby' && this.status !== 'results') {
      this.error(client, 'settings_locked', 'Finish this round before changing the board.');
      return;
    }
    if (!(LIVES_OPTIONS as readonly number[]).includes(message.lives)) {
      this.error(client, 'bad_message', 'That life count is not supported.');
      return;
    }
    if (message.maxPlayers < this.players.size) {
      this.error(client, 'bad_message', 'There are already that many players in the room.');
      return;
    }
    if (!(GAME_KINDS as readonly string[]).includes(message.game)) {
      this.error(client, 'bad_message', 'That game is not on the table.');
      return;
    }
    if (!(SUDOKU_DIFFICULTY_IDS as string[]).includes(message.sudokuDifficulty)) {
      this.error(client, 'bad_message', 'That Sudoku difficulty is not supported.');
      return;
    }
    if (!(KLONDIKE_DRAW_OPTIONS as readonly number[]).includes(message.klondikeDraw)) {
      this.error(client, 'bad_message', 'That Klondike draw is not supported.');
      return;
    }
    if (!isMahjongLayout(message.mahjongLayout)) {
      this.error(client, 'bad_message', 'That Mahjongg layout is not supported.');
      return;
    }
    const preset = PRESETS[message.preset];
    if (!preset) {
      this.error(client, 'bad_message', 'That board does not exist.');
      return;
    }
    this.settings = {
      game: message.game,
      preset: message.preset,
      width: preset.width,
      height: preset.height,
      mines: preset.mines,
      lives: message.lives,
      maxPlayers: Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, message.maxPlayers)),
      lateJoin: message.lateJoin,
      sudokuDifficulty: message.sudokuDifficulty,
      klondikeDraw: message.klondikeDraw,
      mahjongLayout: message.mahjongLayout
    };
    this.touch();
    this.broadcastRoom();
  }

  private handleStart(client: Client): void {
    if (!this.isHost(client)) {
      this.error(client, 'not_host', 'Only the host can start.');
      return;
    }
    if (this.status !== 'lobby') {
      this.error(client, 'bad_message', 'Return to the lobby before starting another game.');
      return;
    }
    if (this.connectedPlayers() === 0) {
      this.error(client, 'bad_message', 'Nobody is connected.');
      return;
    }
    if (this.settings.maxPlayers === 2 && this.connectedPlayers() < 2) {
      this.error(client, 'bad_message', 'A two-seat room needs both players.');
      return;
    }
    if (this.countdownTimer) clearTimeout(this.countdownTimer);
    if (this.resultsTimer) clearTimeout(this.resultsTimer);
    this.resultsTimer = undefined;
    this.resultsEndsAt = undefined;
    this.status = 'countdown';
    this.countdownEndsAt = Date.now() + COUNTDOWN_MS;
    this.touch();
    this.broadcastRoom();
    this.countdownTimer = setTimeout(() => this.beginRound(), COUNTDOWN_MS);
  }

  private beginRound(): void {
    this.countdownTimer = undefined;
    if (this.status !== 'countdown') return;
    if (this.connectedPlayers() === 0) {
      this.cancelCountdown();
      return;
    }
    const now = Date.now();
    if (this.settings.game === 'sudoku') {
      const puzzle = generateSudoku(this.settings.sudokuDifficulty);
      this.sudoku = {
        id: randomUUID(),
        startedAt: now,
        difficulty: this.settings.sudokuDifficulty,
        givens: puzzle.givens,
        solution: puzzle.solution,
        entries: new Map(),
        stats: new Map(
          [...this.players.keys()].map((id) => [id, { correct: 0, wrong: 0 }] as const)
        )
      };
      this.round = null;
      this.solitaire = null;
    } else if (isSolitaireVariant(this.settings.game)) {
      this.solitaire = {
        id: randomUUID(),
        startedAt: now,
        state: dealSolitaire(
          this.settings.game,
          randomInt(0, 2 ** 31 - 1),
          this.settings.klondikeDraw
        ),
        moves: 0,
        stats: new Map([...this.players.keys()].map((id) => [id, 0] as const))
      };
      this.round = null;
      this.sudoku = null;
      this.mahjong = null;
    } else if (this.settings.game === 'mahjong') {
      this.mahjong = {
        id: randomUUID(),
        startedAt: now,
        state: dealMahjong(this.settings.mahjongLayout, randomInt(0, 2 ** 31 - 1)),
        moves: 0,
        stats: new Map([...this.players.keys()].map((id) => [id, 0] as const)),
        selections: new Map()
      };
      this.round = null;
      this.sudoku = null;
      this.solitaire = null;
    } else {
      const { width, height, mines, lives } = this.settings;
      this.round = {
        id: randomUUID(),
        seed: randomInt(0, 2 ** 31 - 1),
        startedAt: now,
        width,
        height,
        mines,
        lives,
        startingLives: lives,
        minesSet: null,
        revealed: new Map(),
        flags: new Map(),
        firstClickDone: false,
        stats: new Map(
          [...this.players.keys()].map((id) => [id, { cells: 0, minesHit: 0 }] as const)
        )
      };
      this.sudoku = null;
      this.solitaire = null;
      this.mahjong = null;
    }
    this.status = 'playing';
    this.lastResult = null;
    this.countdownEndsAt = undefined;
    this.resultsEndsAt = undefined;
    this.pausedAt = undefined;
    this.resumeAt = undefined;
    if (this.resultsTimer) clearTimeout(this.resultsTimer);
    this.resultsTimer = undefined;
    this.touch();
    this.broadcastRoom();
  }

  cancelCountdown(): void {
    if (this.countdownTimer) clearTimeout(this.countdownTimer);
    this.countdownTimer = undefined;
    if (this.status !== 'countdown') return;
    this.status = 'lobby';
    this.countdownEndsAt = undefined;
    this.broadcastRoom();
  }

  private resumeIfPaused(): void {
    if (!this.pausedAt || this.status !== 'playing') return;
    const active = this.round ?? this.sudoku ?? this.solitaire ?? this.mahjong;
    if (!active) return;
    const now = Date.now();
    active.startedAt += Math.max(0, now - this.pausedAt);
    this.pausedAt = undefined;
    this.resumeAt = now + RESUME_MS;
  }

  private activeRound(): Round | null {
    return this.status === 'playing' ? this.round : null;
  }

  private handleReveal(client: Client, i: number): void {
    const player = this.playerFor(client);
    const round = this.activeRound();
    if (!player || !round) return;
    const now = Date.now();
    if (this.resumeAt && now < this.resumeAt) {
      this.error(client, 'resuming', 'The board is resuming.');
      return;
    }
    if (now - player.lastActionAt < ACTION_COOLDOWN_MS) return;
    player.lastActionAt = now;
    if (!Number.isInteger(i) || i < 0 || i >= round.width * round.height) return;
    if (round.revealed.has(i)) {
      this.send(client, { t: 'stale', i });
      return;
    }
    if (round.flags.has(i)) {
      this.send(client, { t: 'stale', i });
      return;
    }

    if (!round.firstClickDone) {
      const exclude = new Set<number>([i, ...neighbors(i, round.width, round.height)]);
      round.minesSet = placeMines(round.width, round.height, round.mines, round.seed, exclude);
      round.firstClickDone = true;
    }
    if (!round.minesSet) return;

    const outcome = revealFrom(
      {
        width: round.width,
        height: round.height,
        mines: round.minesSet,
        revealed: round.revealed,
        flags: round.flags
      },
      i
    );
    if (outcome.cells.length === 0) return;

    const stats = round.stats.get(player.id);
    if (stats) {
      stats.cells += outcome.cells.filter((cell) => cell.n >= 0).length;
      stats.minesHit += outcome.mineHits;
    }

    this.broadcast({ t: 'cells', cells: outcome.cells, by: player.id });
    this.touch();

    if (outcome.mineHits > 0) {
      round.lives = Math.max(0, round.lives - outcome.mineHits);
      this.broadcast({ t: 'life', lives: round.lives, by: player.id, i });
      if (round.lives <= 0) {
        this.endRound('lost');
        return;
      }
    }

    if (
      safeCellsRevealed({
        width: round.width,
        height: round.height,
        mines: round.minesSet,
        revealed: round.revealed,
        flags: round.flags
      }) === totalSafeCells(round.width, round.height, round.mines)
    ) {
      this.endRound('won');
      return;
    }
  }

  private handleFlag(client: Client, i: number): void {
    const player = this.playerFor(client);
    const round = this.activeRound();
    if (!player || !round) return;
    const now = Date.now();
    if (this.resumeAt && now < this.resumeAt) return;
    if (now - player.lastActionAt < 10) return;
    player.lastActionAt = now;
    if (!Number.isInteger(i) || i < 0 || i >= round.width * round.height) return;
    if (round.revealed.has(i)) {
      this.send(client, { t: 'stale', i });
      return;
    }
    const wasFlagged = round.flags.has(i);
    if (wasFlagged) {
      round.flags.delete(i);
    } else {
      round.flags.set(i, player.id);
    }
    this.touch();
    this.broadcast({ t: 'flag', i, on: !wasFlagged, by: player.id });
  }

  private handleChord(client: Client, i: number): void {
    const player = this.playerFor(client);
    const round = this.activeRound();
    if (!player || !round || !round.minesSet) return;
    const now = Date.now();
    if (this.resumeAt && now < this.resumeAt) return;
    if (now - player.lastActionAt < ACTION_COOLDOWN_MS) return;
    player.lastActionAt = now;
    if (!Number.isInteger(i) || i < 0 || i >= round.width * round.height) return;
    const n = round.revealed.get(i);
    if (n === undefined || n <= 0) return;
    const around = neighbors(i, round.width, round.height);
    const flagged = around.filter((index) => round.flags.has(index)).length;
    if (flagged !== n) return;

    const cells: PublicCell[] = [];
    let mineHits = 0;
    for (const index of around) {
      if (round.revealed.has(index) || round.flags.has(index)) continue;
      const outcome = revealFrom(
        {
          width: round.width,
          height: round.height,
          mines: round.minesSet,
          revealed: round.revealed,
          flags: round.flags
        },
        index
      );
      cells.push(...outcome.cells);
      mineHits += outcome.mineHits;
    }
    if (cells.length === 0) return;

    const stats = round.stats.get(player.id);
    if (stats) {
      stats.cells += cells.filter((cell) => cell.n >= 0).length;
      stats.minesHit += mineHits;
    }

    cells.sort((a, b) => a.i - b.i);
    this.broadcast({ t: 'cells', cells, by: player.id });
    this.touch();

    if (mineHits > 0) {
      round.lives = Math.max(0, round.lives - mineHits);
      const firstMine = cells.find((cell) => cell.n === -1);
      this.broadcast({ t: 'life', lives: round.lives, by: player.id, i: firstMine?.i ?? i });
      if (round.lives <= 0) {
        this.endRound('lost');
        return;
      }
    }

    if (
      safeCellsRevealed({
        width: round.width,
        height: round.height,
        mines: round.minesSet,
        revealed: round.revealed,
        flags: round.flags
      }) === totalSafeCells(round.width, round.height, round.mines)
    ) {
      this.endRound('won');
      return;
    }
  }

  private endRound(result: 'won' | 'lost'): void {
    const round = this.round;
    if (!round || this.status !== 'playing') return;
    const now = Date.now();
    round.endedAt = now;
    this.pausedAt = undefined;
    this.resumeAt = undefined;
    this.countdownEndsAt = undefined;
    if (this.countdownTimer) clearTimeout(this.countdownTimer);
    this.countdownTimer = undefined;

    const safeTotal = totalSafeCells(round.width, round.height, round.mines);
    const stats: PlayerStats[] = this.sortedPlayers()
      .map((player) => {
        const stat = round.stats.get(player.id) ?? { cells: 0, minesHit: 0 };
        let flags = 0;
        for (const owner of round.flags.values()) {
          if (owner === player.id) flags += 1;
        }
        return {
          playerId: player.id,
          name: player.name,
          avatar: player.avatar,
          color: player.color,
          cells: stat.cells,
          flags,
          minesHit: stat.minesHit,
          share: safeTotal > 0 ? stat.cells / safeTotal : 0
        };
      })
      .sort((a, b) => b.cells - a.cells);

    this.status = 'results';
    this.sudoku = null;
    this.solitaire = null;
    this.mahjong = null;
    this.lastResult = {
      game: 'minesweeper',
      result,
      endedAt: now,
      durationMs: now - round.startedAt,
      livesLeft: round.lives,
      startingLives: round.startingLives,
      mines: [...(round.minesSet ?? [])].sort((a, b) => a - b),
      revealed: [...round.revealed.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([i, n]) => ({ i, n })),
      flags: [...round.flags.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([i, by]) => ({ i, by })),
      stats
    };
    this.scheduleResultsReturn();
    this.touch();
    this.broadcastRoom();
  }

  private handleSudokuEntry(client: Client, i: number, digit: number): void {
    const player = this.playerFor(client);
    const sudoku =
      this.status === 'playing' && this.settings.game === 'sudoku' ? this.sudoku : null;
    if (!player || !sudoku) return;
    const now = Date.now();
    if (this.resumeAt && now < this.resumeAt) return;
    if (now - player.lastActionAt < SUDOKU_ACTION_COOLDOWN_MS) return;
    player.lastActionAt = now;
    if (!Number.isInteger(i) || i < 0 || i >= 81) return;
    if (!Number.isInteger(digit) || digit < 0 || digit > 9) return;
    if (sudoku.givens[i] !== 0) return;

    if (digit === 0) {
      if (!sudoku.entries.delete(i)) return;
      this.broadcast({ t: 'sudokuCell', i, digit: 0, by: player.id, wrong: false });
      this.touch();
      return;
    }

    const existing = sudoku.entries.get(i);
    if (existing && existing.digit === digit) return;
    const wrong = sudoku.solution[i] !== digit;
    sudoku.entries.set(i, { digit, by: player.id, wrong });
    const stats = sudoku.stats.get(player.id);
    if (stats) {
      if (wrong) stats.wrong += 1;
      else stats.correct += 1;
    }

    this.broadcast({ t: 'sudokuCell', i, digit, by: player.id, wrong });
    this.touch();

    if (isSudokuSolved(sudoku.givens, sudoku.entries, sudoku.solution)) {
      this.endSudoku();
    }
  }

  private endSudoku(): void {
    const sudoku = this.sudoku;
    if (!sudoku || this.status !== 'playing') return;
    const now = Date.now();
    sudoku.endedAt = now;
    this.status = 'results';
    this.round = null;
    this.solitaire = null;
    this.mahjong = null;
    this.pausedAt = undefined;
    this.resumeAt = undefined;
    this.countdownEndsAt = undefined;

    const stats: SudokuPlayerStats[] = this.sortedPlayers()
      .map((player) => {
        const stat = sudoku.stats.get(player.id) ?? { correct: 0, wrong: 0 };
        return {
          playerId: player.id,
          name: player.name,
          avatar: player.avatar,
          color: player.color,
          correct: stat.correct,
          wrong: stat.wrong
        };
      })
      .sort((a, b) => b.correct - a.correct);

    const entries: PublicSudokuEntry[] = [...sudoku.entries.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([i, entry]) => ({
        i,
        digit: entry.digit,
        by: entry.by,
        wrong: entry.wrong
      }));

    this.lastResult = {
      game: 'sudoku',
      result: 'won',
      endedAt: now,
      durationMs: now - sudoku.startedAt,
      difficulty: sudoku.difficulty,
      givens: sudoku.givens,
      entries,
      solution: sudoku.solution,
      stats
    };
    this.scheduleResultsReturn();
    this.touch();
    this.broadcastRoom();
  }

  private handleSolitaireAction(
    client: Client,
    message: Extract<ClientMessage, { t: 'solitaire' }>
  ): void {
    const player = this.playerFor(client);
    const solitaire =
      this.status === 'playing' && isSolitaireVariant(this.settings.game) ? this.solitaire : null;
    if (!player || !solitaire) return;
    const now = Date.now();
    if (this.resumeAt && now < this.resumeAt) return;
    if (now - player.lastActionAt < SUDOKU_ACTION_COOLDOWN_MS) return;
    player.lastActionAt = now;

    let applied = false;
    switch (message.action) {
      case 'draw':
        applied = drawStock(solitaire.state);
        break;
      case 'recycle':
        applied = recycleWaste(solitaire.state);
        break;
      case 'move':
        if (message.card === undefined || !message.to) return;
        applied = playMove(solitaire.state, message.card, message.to);
        break;
      case 'auto':
        if (message.card === undefined) return;
        applied = autoMove(solitaire.state, message.card);
        break;
      default:
        return;
    }
    if (!applied) return;

    autoPlaySafe(solitaire.state);
    solitaire.moves += 1;
    solitaire.stats.set(player.id, (solitaire.stats.get(player.id) ?? 0) + 1);
    this.touch();

    if (solitaireWon(solitaire.state)) {
      this.endSolitaire();
      return;
    }
    this.broadcastRoom();
  }

  private endSolitaire(): void {
    const solitaire = this.solitaire;
    if (!solitaire || this.status !== 'playing') return;
    const now = Date.now();
    solitaire.endedAt = now;
    this.status = 'results';
    this.round = null;
    this.sudoku = null;
    this.pausedAt = undefined;
    this.resumeAt = undefined;
    this.countdownEndsAt = undefined;

    const stats: SolitairePlayerStats[] = this.sortedPlayers()
      .map((player) => ({
        playerId: player.id,
        name: player.name,
        avatar: player.avatar,
        color: player.color,
        moves: solitaire.stats.get(player.id) ?? 0
      }))
      .sort((a, b) => b.moves - a.moves);

    this.lastResult = {
      game: solitaire.state.variant,
      result: 'won',
      endedAt: now,
      durationMs: now - solitaire.startedAt,
      variant: solitaire.state.variant,
      draw: solitaire.state.draw,
      moves: solitaire.moves,
      passes: solitaire.state.passes,
      stats
    } satisfies SolitaireResult;
    this.scheduleResultsReturn();
    this.touch();
    this.broadcastRoom();
  }

  private handleMahjongAction(
    client: Client,
    message: Extract<ClientMessage, { t: 'mahjong' }>
  ): void {
    const player = this.playerFor(client);
    const mahjong =
      this.status === 'playing' && this.settings.game === 'mahjong' ? this.mahjong : null;
    if (!player || !mahjong) return;
    const now = Date.now();
    if (this.resumeAt && now < this.resumeAt) return;
    if (message.action === 'select') {
      this.handleMahjongSelect(player, mahjong, message.i);
      return;
    }
    if (now - player.lastActionAt < SUDOKU_ACTION_COOLDOWN_MS) return;
    player.lastActionAt = now;

    const state = mahjong.state;
    if (message.action === 'shuffle') {
      // The server only allows a shuffle when the table is out of matches.
      if (!shuffleRemaining(state, randomInt(0, 2 ** 31 - 1))) return;
      this.touch();
      this.broadcastRoom();
      return;
    }

    if (message.a === undefined || message.b === undefined) return;
    if (!playMatch(state, message.a, message.b)) return;

    // A matched tile can no longer be anybody's current pick.
    for (const [playerId, selected] of mahjong.selections) {
      if (state.tiles[selected] < 0) mahjong.selections.delete(playerId);
    }

    mahjong.moves += 1;
    mahjong.stats.set(player.id, (mahjong.stats.get(player.id) ?? 0) + 1);
    this.touch();

    if (mahjongWon(state)) {
      this.endMahjong();
      return;
    }
    this.broadcastRoom();
  }

  private handleMahjongSelect(
    player: Player,
    mahjong: MahjongRound,
    i: number | null | undefined
  ): void {
    const now = Date.now();
    if (now - player.lastSelectAt < SELECT_COOLDOWN_MS) return;
    player.lastSelectAt = now;

    if (i === null || i === undefined) {
      if (!mahjong.selections.delete(player.id)) return;
    } else {
      if (!Number.isInteger(i) || i < 0 || i >= mahjong.state.tiles.length) return;
      if (!isTileFree(mahjong.state.layout, mahjong.state.tiles, i)) return;
      if (mahjong.selections.get(player.id) === i) return;
      mahjong.selections.set(player.id, i);
    }
    this.touch();
    this.broadcastRoom();
  }

  private endMahjong(): void {
    const mahjong = this.mahjong;
    if (!mahjong || this.status !== 'playing') return;
    const now = Date.now();
    mahjong.endedAt = now;
    this.status = 'results';
    this.round = null;
    this.sudoku = null;
    this.solitaire = null;
    this.pausedAt = undefined;
    this.resumeAt = undefined;
    this.countdownEndsAt = undefined;

    const stats: MahjongPlayerStats[] = this.sortedPlayers()
      .map((player) => ({
        playerId: player.id,
        name: player.name,
        avatar: player.avatar,
        color: player.color,
        matches: mahjong.stats.get(player.id) ?? 0
      }))
      .sort((a, b) => b.matches - a.matches);

    this.lastResult = {
      game: 'mahjong',
      result: 'won',
      endedAt: now,
      durationMs: now - mahjong.startedAt,
      layout: mahjong.state.layout,
      moves: mahjong.moves,
      shuffles: mahjong.state.shuffles,
      stats
    } satisfies MahjongResult;
    this.scheduleResultsReturn();
    this.touch();
    this.broadcastRoom();
  }

  private scheduleResultsReturn(): void {
    if (this.resultsTimer) clearTimeout(this.resultsTimer);
    this.resultsEndsAt = Date.now() + RESULTS_RETURN_MS;
    this.resultsTimer = setTimeout(() => {
      this.resultsTimer = undefined;
      if (this.status === 'results') this.transitionToLobby(true);
    }, RESULTS_RETURN_MS);
  }

  private handleReturnLobby(client: Client): void {
    if (!this.isHost(client)) {
      this.error(client, 'not_host', 'Only the host can call everyone back to the lobby.');
      return;
    }
    if (this.status === 'lobby') return;
    this.transitionToLobby(this.status === 'results');
  }

  private transitionToLobby(keepResult: boolean): void {
    if (this.resultsTimer) clearTimeout(this.resultsTimer);
    if (this.countdownTimer) clearTimeout(this.countdownTimer);
    this.resultsTimer = undefined;
    this.countdownTimer = undefined;
    this.resultsEndsAt = undefined;
    this.countdownEndsAt = undefined;
    this.pausedAt = undefined;
    this.resumeAt = undefined;
    this.round = null;
    this.sudoku = null;
    this.solitaire = null;
    this.mahjong = null;
    if (!keepResult) this.lastResult = null;
    this.status = 'lobby';
    this.touch();
    this.broadcastRoom();
  }

  private handleCursor(client: Client, x: number, y: number): void {
    const player = this.playerFor(client);
    if (!player || this.status !== 'playing') return;
    const now = Date.now();
    if (now - player.lastCursorAt < CURSOR_COOLDOWN_MS) return;
    player.lastCursorAt = now;
    if (x < 0 || y < 0) {
      this.broadcast(
        {
          t: 'cursor',
          id: player.id,
          x: -1,
          y: -1,
          name: player.name,
          color: player.color,
          avatar: player.avatar,
          leave: true
        },
        client
      );
      return;
    }
    this.broadcast(
      {
        t: 'cursor',
        id: player.id,
        x,
        y,
        name: player.name,
        color: player.color,
        avatar: player.avatar
      },
      client
    );
  }

  private handleLeave(client: Client): void {
    if (client.role === 'spectator') {
      this.spectators.delete(client.id);
      this.broadcastRoom(client);
      this.touch();
      return;
    }
    const player = this.playerFor(client);
    if (player) {
      this.removePlayer(player, true);
      client.close(4000, 'left');
    }
  }

  private removePlayer(player: Player, explicit: boolean): void {
    const wasHost = player.id === this.hostId;
    this.players.delete(player.id);
    this.mahjong?.selections.delete(player.id);
    if (wasHost) {
      if (this.hostTimer) clearTimeout(this.hostTimer);
      this.hostTimer = undefined;
    }
    if (this.connectedPlayers() === 0) {
      if (this.status === 'countdown') {
        this.cancelCountdown();
      } else if (this.status === 'playing') {
        this.pausedAt = this.pausedAt ?? Date.now();
      }
    }
    if (this.players.size === 0) {
      this.hostId = null;
      this.status = 'lobby';
      this.round = null;
      this.sudoku = null;
      this.solitaire = null;
      this.mahjong = null;
      this.lastResult = null;
      this.pausedAt = undefined;
      this.resumeAt = undefined;
      this.countdownEndsAt = undefined;
      this.resultsEndsAt = undefined;
      if (this.countdownTimer) clearTimeout(this.countdownTimer);
      this.countdownTimer = undefined;
      if (this.resultsTimer) clearTimeout(this.resultsTimer);
      this.resultsTimer = undefined;
    } else if (wasHost) {
      this.promoteHost();
    }
    this.broadcastRoom();
    if (explicit) this.touch();
  }

  disconnect(client: Client): void {
    if (this.destroyed) return;
    if (client.role === 'spectator') {
      if (this.spectators.delete(client.id)) this.broadcastRoom(client);
      return;
    }
    const player = this.players.get(client.playerId ?? '');
    if (!player || !player.client || player.client.id !== client.id) return;
    player.client = null;
    player.connected = false;
    player.removeAt = Date.now() + (this.status === 'playing' ? PLAYING_SEAT_TTL_MS : LOBBY_SEAT_TTL_MS);
    this.mahjong?.selections.delete(player.id);

    this.broadcast(
      {
        t: 'cursor',
        id: player.id,
        x: -1,
        y: -1,
        name: player.name,
        color: player.color,
        avatar: player.avatar,
        leave: true
      },
      client
    );
    if (player.id === this.hostId) this.scheduleHostMigration();
    if (this.connectedPlayers() === 0) {
      if (this.status === 'countdown') {
        this.cancelCountdown();
      } else if (this.status === 'playing' && !this.pausedAt) {
        this.pausedAt = Date.now();
      }
    }
    this.broadcastRoom(client);
  }

  private scheduleHostMigration(): void {
    if (this.hostTimer) clearTimeout(this.hostTimer);
    this.hostTimer = setTimeout(() => {
      this.hostTimer = undefined;
      const host = this.hostPlayer();
      if (host?.connected) return;
      this.promoteHost();
    }, HOST_MIGRATION_MS);
  }

  private promoteHost(): void {
    const connected = this.sortedPlayers().filter((player) => player.connected);
    const next = connected[0] ?? this.sortedPlayers()[0];
    if (!next) {
      this.hostId = null;
      return;
    }
    this.hostId = next.id;
    this.broadcastRoom();
  }

  private handleClose(client: Client): void {
    if (!this.isHost(client)) {
      this.error(client, 'not_host', 'Only the host can close the room.');
      return;
    }
    const host = this.hostPlayer();
    this.destroy(`${host?.name ?? 'The host'} closed the room.`);
  }

  destroy(message: string): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.hostTimer) clearTimeout(this.hostTimer);
    if (this.countdownTimer) clearTimeout(this.countdownTimer);
    if (this.resultsTimer) clearTimeout(this.resultsTimer);
    this.hostTimer = undefined;
    this.countdownTimer = undefined;
    this.resultsTimer = undefined;
    for (const player of this.players.values()) {
      if (player.client) {
        player.client.send({ t: 'closed', message });
        player.client.close(4003, 'closed');
      }
    }
    for (const spectator of this.spectators.values()) {
      spectator.send({ t: 'closed', message });
      spectator.close(4003, 'closed');
    }
    this.spectators.clear();
    this.onDestroy(this.code);
  }

  sweep(now: number): void {
    let removed = false;
    for (const player of [...this.players.values()]) {
      if (!player.connected && player.removeAt && player.removeAt <= now) {
        const wasHost = player.id === this.hostId;
        this.players.delete(player.id);
        removed = true;
        if (wasHost) {
          if (this.hostTimer) clearTimeout(this.hostTimer);
          this.hostTimer = undefined;
          this.promoteHost();
        }
      }
    }
    if (removed) {
      if (this.players.size === 0) {
        this.hostId = null;
        this.status = 'lobby';
        this.round = null;
        this.sudoku = null;
        this.solitaire = null;
        this.mahjong = null;
        this.lastResult = null;
        this.pausedAt = undefined;
        this.resumeAt = undefined;
        this.countdownEndsAt = undefined;
        this.resultsEndsAt = undefined;
        if (this.resultsTimer) clearTimeout(this.resultsTimer);
        this.resultsTimer = undefined;
      }
      this.broadcastRoom();
    }
    if (this.connectedPlayers() === 0 && this.status === 'countdown') {
      this.cancelCountdown();
    }
    if (this.connectedPlayers() === 0 && this.status === 'playing' && !this.pausedAt) {
      this.pausedAt = now;
      this.broadcastRoom();
    }
  }

  isExpired(now: number): boolean {
    if (this.players.size > 0) {
      return now - this.createdAt > 7 * 24 * 60 * 60_000;
    }
    return now - this.lastActivity > ROOM_TTL_MS;
  }

  roomSummary(): { code: string; players: number; connected: number; status: RoomStatus } {
    return {
      code: this.code,
      players: this.players.size,
      connected: this.connectedPlayers(),
      status: this.status
    };
  }
}
