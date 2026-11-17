import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applySolitaireMoves } from '../solitaire';
import type { PublicSolitaire, ServerMessage } from '../types';
import type { Client } from './client';
import type { RoomSettings } from '../types';
import { freeTileIndices, tilesMatch } from '../mahjong';
import { newId } from './crypto';
import { Room, defaultSettings, hashToken } from './room';

interface TestClient extends Client {
  messages: ServerMessage[];
}

function testClient(): TestClient {
  const messages: ServerMessage[] = [];
  return {
    id: newId(),
    messages,
    send(message: ServerMessage) {
      messages.push(message);
    },
    close() {
    }
  };
}

function makeRoom(overrides: Partial<RoomSettings> = {}): Room {
  return new Room(
    'K7QP',
    {
      ...defaultSettings(),
      preset: 'cozy',
      width: 9,
      height: 9,
      mines: 10,
      lives: 3,
      maxPlayers: 8,
      ...overrides
    },
    hashToken('host-token'),
    () => undefined
  );
}

describe('room defaults', () => {
  it('gives new rooms two lives', () => {
    expect(defaultSettings().lives).toBe(2);
  });
});

describe('room flow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-30T04:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('claims the host seat with the create token and seats guests', () => {
    const room = makeRoom();
    const host = testClient();
    const guest = testClient();
    room.handleJoin(host, {
      t: 'join',
      code: 'K7QP',
      name: 'Maya',
      avatar: '🦊',
      token: 'host-token'
    });
    room.handleJoin(guest, { t: 'join', code: 'K7QP', name: 'Sam', avatar: '🐈' });

    expect(room.hostId).toBeTruthy();
    const publicRoom = room.toPublic();
    expect(publicRoom.players).toHaveLength(2);
    expect(publicRoom.players.find((player) => player.isHost)?.name).toBe('Maya');
    expect(publicRoom.players.find((player) => player.name === 'Sam')?.isHost).toBe(false);
  });

  it('runs a countdown, starts a round, and reveals cells', () => {
    const room = makeRoom();
    const host = testClient();
    const guest = testClient();
    room.handleJoin(host, {
      t: 'join',
      code: 'K7QP',
      name: 'Maya',
      avatar: '🦊',
      token: 'host-token'
    });
    room.handleJoin(guest, { t: 'join', code: 'K7QP', name: 'Sam', avatar: '🐈' });
    room.handleMessage(host, { t: 'start' });
    expect(room.status).toBe('countdown');
    vi.advanceTimersByTime(3_000);
    expect(room.status).toBe('playing');
    expect(room.round?.revealed.size).toBe(0);

    room.handleMessage(host, { t: 'reveal', i: 40 });
    expect(room.round?.revealed.size).toBeGreaterThan(0);
    expect(room.round?.firstClickDone).toBe(true);
    expect(guest.messages.some((message) => message.t === 'cells')).toBe(true);
  });

  it('keeps a two-seat room waiting for the second player', () => {
    const room = makeRoom({ maxPlayers: 2 });
    const host = testClient();
    room.handleJoin(host, {
      t: 'join',
      code: 'K7QP',
      name: 'Maya',
      avatar: '🦊',
      token: 'host-token'
    });

    room.handleMessage(host, { t: 'start' });
    expect(room.status).toBe('lobby');
    expect(host.messages.some((message) => message.t === 'error')).toBe(true);

    const guest = testClient();
    room.handleJoin(guest, { t: 'join', code: 'K7QP', name: 'Sam', avatar: '🐈' });
    room.handleMessage(host, { t: 'start' });
    expect(room.status).toBe('countdown');
  });

  it('lets the host end a round early and non-hosts keep playing', () => {
    const room = makeRoom();
    const host = testClient();
    const guest = testClient();
    room.handleJoin(host, {
      t: 'join',
      code: 'K7QP',
      name: 'Maya',
      avatar: '🦊',
      token: 'host-token'
    });
    room.handleJoin(guest, { t: 'join', code: 'K7QP', name: 'Sam', avatar: '🐈' });
    room.handleMessage(host, { t: 'start' });
    vi.advanceTimersByTime(3_000);
    expect(room.status).toBe('playing');

    room.handleMessage(guest, { t: 'lobby' });
    expect(room.status).toBe('playing');
    expect(guest.messages.some((message) => message.t === 'error')).toBe(true);

    room.handleMessage(host, { t: 'lobby' });
    expect(room.status).toBe('lobby');
    expect(room.round).toBeNull();
    expect(room.lastResult).toBeNull();
  });

  it('lets the host cancel a countdown', () => {
    const room = makeRoom();
    const host = testClient();
    const guest = testClient();
    room.handleJoin(host, {
      t: 'join',
      code: 'K7QP',
      name: 'Maya',
      avatar: '🦊',
      token: 'host-token'
    });
    room.handleJoin(guest, { t: 'join', code: 'K7QP', name: 'Sam', avatar: '🐈' });
    room.handleMessage(host, { t: 'start' });
    expect(room.status).toBe('countdown');

    room.handleMessage(host, { t: 'lobby' });
    expect(room.status).toBe('lobby');
    vi.advanceTimersByTime(3_000);
    expect(room.status).toBe('lobby');
  });

  it('returns Minesweeper players to the lobby after the result', () => {
    const room = makeRoom({ lives: 1 });
    const host = testClient();
    const guest = testClient();
    room.handleJoin(host, {
      t: 'join',
      code: 'K7QP',
      name: 'Maya',
      avatar: '🦊',
      token: 'host-token'
    });
    room.handleJoin(guest, { t: 'join', code: 'K7QP', name: 'Sam', avatar: '🐈' });
    room.handleMessage(host, { t: 'start' });
    vi.advanceTimersByTime(3_000);
    room.handleMessage(host, { t: 'reveal', i: 40 });
    const round = room.round!;
    const mine = [...(round.minesSet ?? [])].find((i) => !round.revealed.has(i));
    expect(mine).toBeTruthy();
    vi.advanceTimersByTime(60);
    room.handleMessage(host, { t: 'reveal', i: mine! });
    expect(room.status).toBe('results');
    expect(room.lastResult?.game).toBe('minesweeper');
    vi.advanceTimersByTime(12_000);
    expect(room.status).toBe('lobby');
    expect(room.lastResult?.game).toBe('minesweeper');
    expect(room.round).toBeNull();
  });

  function startedMineRound(seed: number) {
    const room = makeRoom();
    const host = testClient();
    const guest = testClient();
    room.handleJoin(host, {
      t: 'join',
      code: 'K7QP',
      name: 'Maya',
      avatar: '🦊',
      token: 'host-token'
    });
    room.handleJoin(guest, { t: 'join', code: 'K7QP', name: 'Sam', avatar: '🐈' });
    room.handleMessage(host, { t: 'start' });
    vi.advanceTimersByTime(3_000);
    room.round!.seed = seed;
    room.handleMessage(host, { t: 'reveal', i: 40 });
    vi.advanceTimersByTime(60);
    return { room, host, guest };
  }

  it('auto-flags every hidden neighbor of a number when they must all be mines', () => {
    const { room, host, guest } = startedMineRound(42);
    const hostId = room.toPublic().players.find((player) => player.isHost)!.id;
    room.handleMessage(host, { t: 'flagChord', i: 22 });
    expect(room.round?.flags.get(14)).toBe(hostId);
    const synced = guest.messages.filter((message) => message.t === 'flag');
    expect(synced.filter((message) => message.t === 'flag' && message.i === 14 && message.on)).toHaveLength(1);
  });

  it('counts existing flags when auto-flagging the rest', () => {
    const { room, host } = startedMineRound(42);
    const hostId = room.toPublic().players.find((player) => player.isHost)!.id;
    room.handleMessage(host, { t: 'flag', i: 65 });
    vi.advanceTimersByTime(60);
    room.handleMessage(host, { t: 'flagChord', i: 57 });
    expect(room.round?.flags.get(66)).toBe(hostId);
  });

  it('does nothing when a hidden neighbor could still be safe', () => {
    const { room, host } = startedMineRound(42);
    room.handleMessage(host, { t: 'flagChord', i: 13 });
    expect(room.round?.flags.size).toBe(0);
  });

  it('ignores flag chords aimed at hidden or flagged tiles', () => {
    const { room, host } = startedMineRound(42);
    room.handleMessage(host, { t: 'flagChord', i: 3 });
    vi.advanceTimersByTime(60);
    room.handleMessage(host, { t: 'flag', i: 14 });
    vi.advanceTimersByTime(60);
    room.handleMessage(host, { t: 'flagChord', i: 14 });
    expect(room.round?.flags.has(3)).toBe(false);
    expect(room.round?.flags.size).toBe(1);
  });

  it('counts an already uncovered mine as flagged when chording', () => {
    const { room, host } = startedMineRound(42);
    room.handleMessage(host, { t: 'reveal', i: 61 });
    vi.advanceTimersByTime(60);
    expect(room.round?.revealed.get(61)).toBe(-1);
    expect(room.round?.lives).toBe(2);
    room.handleMessage(host, { t: 'chord', i: 60 });
    expect(room.round?.revealed.get(70)).toBe(1);
  });

  it('still refuses a chord while another mine around the number is hidden', () => {
    const { room, host } = startedMineRound(42);
    room.handleMessage(host, { t: 'reveal', i: 61 });
    vi.advanceTimersByTime(60);
    room.handleMessage(host, { t: 'chord', i: 69 });
    expect(room.round?.revealed.has(78)).toBe(false);
    vi.advanceTimersByTime(60);
    room.handleMessage(host, { t: 'flag', i: 77 });
    vi.advanceTimersByTime(60);
    room.handleMessage(host, { t: 'chord', i: 69 });
    expect(room.round?.revealed.get(78)).toBeDefined();
  });

  it('runs a shared Sudoku and returns everyone to the lobby', () => {
    const room = makeRoom({ game: 'sudoku', sudokuDifficulty: 'easy' });
    const host = testClient();
    const guest = testClient();
    room.handleJoin(host, {
      t: 'join',
      code: 'K7QP',
      name: 'Maya',
      avatar: '🦊',
      token: 'host-token'
    });
    room.handleJoin(guest, { t: 'join', code: 'K7QP', name: 'Sam', avatar: '🐈' });
    room.handleMessage(host, { t: 'start' });
    vi.advanceTimersByTime(3_000);
    expect(room.status).toBe('playing');
    expect(room.sudoku).toBeTruthy();
    const sudoku = room.sudoku!;
    const empty = sudoku.givens.findIndex((digit) => digit === 0);
    const wrong = (sudoku.solution[empty] % 9) + 1;
    room.handleMessage(host, { t: 'sudoku', i: empty, digit: wrong });
    expect(room.sudoku?.entries.get(empty)?.wrong).toBe(true);
    expect(guest.messages.some((message) => message.t === 'sudokuCell')).toBe(true);

    for (let i = 0; i < 81; i += 1) {
      if (sudoku.givens[i]) continue;
      vi.advanceTimersByTime(40);
      room.handleMessage(guest, { t: 'sudoku', i, digit: sudoku.solution[i] });
    }
    expect(room.status).toBe('results');
    expect(room.lastResult?.game).toBe('sudoku');
    expect(room.resultsEndsAt).toBeGreaterThan(Date.now());
    vi.advanceTimersByTime(12_000);
    expect(room.status).toBe('lobby');
    expect(room.lastResult?.game).toBe('sudoku');
    expect(room.sudoku).toBeNull();
  });

  it('deals a shared Klondike table and records draws', () => {
    const room = makeRoom({ game: 'klondike', klondikeDraw: 1 });
    const host = testClient();
    const guest = testClient();
    room.handleJoin(host, {
      t: 'join',
      code: 'K7QP',
      name: 'Maya',
      avatar: '🦊',
      token: 'host-token'
    });
    room.handleJoin(guest, { t: 'join', code: 'K7QP', name: 'Sam', avatar: '🐈' });
    room.handleMessage(host, { t: 'start' });
    vi.advanceTimersByTime(3_000);

    expect(room.status).toBe('playing');
    expect(room.solitaire).toBeTruthy();
    expect(room.round).toBeNull();
    expect(room.sudoku).toBeNull();
    expect(room.toPublic().solitaire?.stockCount).toBe(24);

    guest.messages.length = 0;
    room.handleMessage(host, { t: 'solitaire', action: 'draw' });
    // The drawn card lands in the waste, or straight on its foundation when
    // safe autoplay snatches an ace or two.
    expect(room.solitaire?.state.stock).toHaveLength(23);
    expect(room.toPublic().solitaire?.moves).toBe(1);
    expect(guest.messages.some((message) => message.t === 'solitaireMove')).toBe(true);
    expect(guest.messages.some((message) => message.t === 'room')).toBe(false);
  });

  it('deals a FreeCell table with four free cells', () => {
    const room = makeRoom({ game: 'freecell' });
    const host = testClient();
    room.handleJoin(host, {
      t: 'join',
      code: 'K7QP',
      name: 'Maya',
      avatar: '🦊',
      token: 'host-token'
    });
    room.handleMessage(host, { t: 'start' });
    vi.advanceTimersByTime(3_000);

    expect(room.solitaire?.state.variant).toBe('freecell');
    const publicState = room.toPublic().solitaire!;
    expect(publicState.stockCount).toBe(0);
    expect(publicState.freeCells).toEqual([null, null, null, null]);
    expect(publicState.tableau.map((column) => column.length)).toEqual([7, 7, 7, 7, 6, 6, 6, 6]);
  });

  it('ends a solitaire round when the last foundation card lands', () => {
    const room = makeRoom({ game: 'klondike' });
    const host = testClient();
    const guest = testClient();
    room.handleJoin(host, {
      t: 'join',
      code: 'K7QP',
      name: 'Maya',
      avatar: '🦊',
      token: 'host-token'
    });
    room.handleJoin(guest, { t: 'join', code: 'K7QP', name: 'Sam', avatar: '🐈' });
    room.handleMessage(host, { t: 'start' });
    vi.advanceTimersByTime(3_000);

    const solitaire = room.solitaire!;
    solitaire.state.tableau = [[], [], [], [], [], [], [51]];
    solitaire.state.faceDown = [0, 0, 0, 0, 0, 0, 0];
    solitaire.state.foundations = [
      Array.from({ length: 13 }, (_, index) => index),
      Array.from({ length: 13 }, (_, index) => 13 + index),
      Array.from({ length: 13 }, (_, index) => 26 + index),
      Array.from({ length: 12 }, (_, index) => 39 + index)
    ];
    room.handleMessage(host, { t: 'solitaire', action: 'auto', card: 51 });

    expect(room.status).toBe('results');
    expect(room.lastResult?.game).toBe('klondike');
    expect(room.toPublic().solitaire?.foundations[3]).toHaveLength(13);
    expect(room.resultsEndsAt).toBeGreaterThan(Date.now());

    vi.advanceTimersByTime(12_000);
    expect(room.status).toBe('lobby');
    expect(room.solitaire).toBeNull();
  });

  it('shares Mahjong picks and clears them when the tiles are matched', () => {
    const room = makeRoom({ game: 'mahjong', mahjongLayout: 'cozy' });
    const host = testClient();
    const guest = testClient();
    room.handleJoin(host, {
      t: 'join',
      code: 'K7QP',
      name: 'Maya',
      avatar: '🦊',
      token: 'host-token'
    });
    room.handleJoin(guest, { t: 'join', code: 'K7QP', name: 'Sam', avatar: '🐈' });
    room.handleMessage(host, { t: 'start' });
    vi.advanceTimersByTime(3_000);

    const mahjong = room.mahjong!;
    const free = freeTileIndices(mahjong.state.layout, mahjong.state.tiles);
    const hostId = room.hostId!;
    const guestId = [...room.players.keys()].find((id) => id !== hostId)!;

    room.handleMessage(host, { t: 'mahjong', action: 'select', i: free[0] });
    expect(room.toPublic().mahjong?.selections).toEqual([{ by: hostId, i: free[0] }]);

    let pair: [number, number] | null = null;
    for (let a = 0; a < free.length && !pair; a += 1) {
      for (let b = a + 1; b < free.length; b += 1) {
        if (tilesMatch(mahjong.state.tiles[free[a]], mahjong.state.tiles[free[b]])) {
          pair = [free[a], free[b]];
          break;
        }
      }
    }
    expect(pair).toBeTruthy();
    const [a, b] = pair!;
    vi.advanceTimersByTime(40);
    room.handleMessage(host, { t: 'mahjong', action: 'select', i: a });
    room.handleMessage(guest, { t: 'mahjong', action: 'select', i: b });
    expect(room.toPublic().mahjong?.selections).toHaveLength(2);

    room.handleMessage(host, { t: 'mahjong', action: 'match', a, b });
    expect(room.mahjong?.state.tiles[a]).toBe(-1);
    expect(room.toPublic().mahjong?.selections).toEqual([]);
    expect(guestId).toBeTruthy();
  });

  it('clears a Mahjong pick when the player disconnects', () => {
    const room = makeRoom({ game: 'mahjong', mahjongLayout: 'cozy' });
    const host = testClient();
    const guest = testClient();
    room.handleJoin(host, {
      t: 'join',
      code: 'K7QP',
      name: 'Maya',
      avatar: '🦊',
      token: 'host-token'
    });
    room.handleJoin(guest, { t: 'join', code: 'K7QP', name: 'Sam', avatar: '🐈' });
    room.handleMessage(host, { t: 'start' });
    vi.advanceTimersByTime(3_000);

    const mahjong = room.mahjong!;
    const free = freeTileIndices(mahjong.state.layout, mahjong.state.tiles);
    const guestId = [...room.players.keys()].find((id) => id !== room.hostId)!;
    room.handleMessage(guest, { t: 'mahjong', action: 'select', i: free[0] });
    expect(room.toPublic().mahjong?.selections).toContainEqual({ by: guestId, i: free[0] });

    room.disconnect(guest);
    expect(room.toPublic().mahjong?.selections).toEqual([]);
  });

  it('moves host after the host disappears for a minute', () => {
    const room = makeRoom();
    const host = testClient();
    const guest = testClient();
    room.handleJoin(host, {
      t: 'join',
      code: 'K7QP',
      name: 'Maya',
      avatar: '🦊',
      token: 'host-token'
    });
    room.handleJoin(guest, { t: 'join', code: 'K7QP', name: 'Sam', avatar: '🐈' });
    const originalHost = room.hostId;

    room.disconnect(host);
    vi.advanceTimersByTime(60_000);
    expect(room.hostId).not.toBe(originalHost);
    expect(room.toPublic().players.find((player) => player.isHost)?.name).toBe('Sam');
  });
});

describe('wire traffic', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-30T04:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function playingRoom(overrides: Partial<RoomSettings> = {}) {
    const room = makeRoom(overrides);
    const host = testClient();
    const guest = testClient();
    room.handleJoin(host, {
      t: 'join',
      code: 'K7QP',
      name: 'Maya',
      avatar: '🦊',
      token: 'host-token'
    });
    room.handleJoin(guest, { t: 'join', code: 'K7QP', name: 'Sam', avatar: '🐈' });
    room.handleMessage(host, { t: 'start' });
    vi.advanceTimersByTime(3_000);
    return { room, host, guest };
  }

  it('issues short ids instead of uuids', () => {
    expect(newId()).toMatch(/^[23456789BCDFGHJKMNPQRSTVWXYZ]{8}$/);
  });

  it('carries only id and position on the cursor wire', () => {
    const { room, host, guest } = playingRoom();
    guest.messages.length = 0;
    room.handleMessage(host, { t: 'cursor', x: 0.5, y: 0.25 });
    const message = guest.messages.find((entry) => entry.t === 'cursor');
    expect(message).toEqual({ t: 'cursor', id: room.hostId, x: 0.5, y: 0.25 });
  });

  it('replays a full Klondike pass cycle from card moves alone', () => {
    const { room, guest } = playingRoom({ game: 'klondike' });
    let table: PublicSolitaire = room.toPublic().solitaire!;

    // Draw the stock dry, applying only the diff each move broadcasts.
    for (let step = 0; step < 60; step += 1) {
      guest.messages.length = 0;
      room.handleMessage(guest, { t: 'solitaire', action: 'draw' });
      const message = guest.messages.find((entry) => entry.t === 'solitaireMove');
      if (!message || message.t !== 'solitaireMove') break;
      table = {
        ...applySolitaireMoves(table, message.moves),
        moves: message.totalMoves,
        passes: message.passes
      };
      vi.advanceTimersByTime(40);
    }
    expect(room.solitaire?.state.stock).toHaveLength(0);
    expect(table.stockCount).toBe(0);

    // Recycle moves the whole waste into the stock; the push order must survive.
    // The draw that found an empty stock still spent its cooldown slot.
    vi.advanceTimersByTime(40);
    guest.messages.length = 0;
    room.handleMessage(guest, { t: 'solitaire', action: 'recycle' });
    const recycle = guest.messages.find((entry) => entry.t === 'solitaireMove');
    expect(recycle?.t).toBe('solitaireMove');
    if (recycle?.t === 'solitaireMove') {
      table = {
        ...applySolitaireMoves(table, recycle.moves),
        moves: recycle.totalMoves,
        passes: recycle.passes
      };
    }
    expect(table).toEqual(room.toPublic().solitaire);
  });

  it('syncs Mahjong picks and matches without the whole stack', () => {
    const { room, host, guest } = playingRoom({ game: 'mahjong', mahjongLayout: 'cozy' });
    const tiles = room.mahjong!.state.tiles;
    const free = freeTileIndices(room.mahjong!.state.layout, tiles);

    let pair: [number, number] | null = null;
    for (let a = 0; a < free.length && !pair; a += 1) {
      for (let b = a + 1; b < free.length; b += 1) {
        if (tilesMatch(tiles[free[a]], tiles[free[b]])) {
          pair = [free[a], free[b]];
          break;
        }
      }
    }
    expect(pair).toBeTruthy();
    const [a, b] = pair!;

    guest.messages.length = 0;
    room.handleMessage(host, { t: 'mahjong', action: 'select', i: a });
    expect(guest.messages.find((entry) => entry.t === 'mahjongSelect')).toEqual({
      t: 'mahjongSelect',
      by: room.hostId,
      i: a
    });
    expect(guest.messages.some((entry) => entry.t === 'room')).toBe(false);

    vi.advanceTimersByTime(40);
    guest.messages.length = 0;
    room.handleMessage(host, { t: 'mahjong', action: 'match', a, b });
    expect(guest.messages.find((entry) => entry.t === 'mahjongMatch')).toEqual({
      t: 'mahjongMatch',
      a,
      b
    });
    expect(tiles[a]).toBe(-1);
    expect(tiles[b]).toBe(-1);
  });

  it('sends the re-dealt stack once on a Mahjong shuffle', () => {
    const { room, host, guest } = playingRoom({ game: 'mahjong', mahjongLayout: 'cozy' });
    const tiles = room.mahjong!.state.tiles;

    // Leave two non-matching tiles, so the table is out of matches.
    let x = -1;
    let y = -1;
    outer: for (let i = 0; i < tiles.length; i += 1) {
      for (let j = i + 1; j < tiles.length; j += 1) {
        if (!tilesMatch(i, j)) {
          [x, y] = [i, j];
          break outer;
        }
      }
    }
    expect(x).toBeGreaterThanOrEqual(0);
    tiles.fill(-1);
    tiles[0] = x;
    tiles[tiles.length - 1] = y;

    guest.messages.length = 0;
    room.handleMessage(host, { t: 'mahjong', action: 'shuffle' });
    expect(
      guest.messages.some((entry) => entry.t === 'mahjongShuffle' && entry.shuffles === 1)
    ).toBe(true);
    expect(guest.messages.some((entry) => entry.t === 'room')).toBe(false);
  });

  it('broadcasts the result once and keeps later room messages light', () => {
    const { room, host, guest } = playingRoom({ lives: 1 });
    room.handleMessage(host, { t: 'reveal', i: 40 });
    const round = room.round!;
    const mine = [...(round.minesSet ?? [])].find((i) => !round.revealed.has(i));
    expect(mine).toBeTruthy();
    vi.advanceTimersByTime(60);
    room.handleMessage(host, { t: 'reveal', i: mine! });
    expect(room.status).toBe('results');

    const endMessage = [...guest.messages].reverse().find((entry) => entry.t === 'room');
    expect(endMessage?.t === 'room' && endMessage.room.lastResult).toBeTruthy();

    guest.messages.length = 0;
    room.handleMessage(guest, { t: 'profile', name: 'Sammy', avatar: '🐈' });
    const later = guest.messages.filter((entry) => entry.t === 'room');
    expect(later.length).toBeGreaterThan(0);
    expect(later.every((entry) => entry.t === 'room' && entry.room.lastResult === undefined)).toBe(
      true
    );
    expect(room.lastResult).toBeTruthy();
  });
});
