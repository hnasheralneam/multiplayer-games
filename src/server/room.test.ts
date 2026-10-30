import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { WebSocket } from 'ws';
import type { ServerMessage } from '../shared/types';
import type { Client } from './client';
import type { RoomSettings } from '../shared/types';
import { Room, defaultSettings, hashToken } from './room';

interface TestClient extends Client {
  messages: ServerMessage[];
}

function testClient(): TestClient {
  const messages: ServerMessage[] = [];
  return {
    id: randomUUID(),
    ip: '127.0.0.1',
    socket: { readyState: 1 } as WebSocket,
    joinedAt: Date.now(),
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

    room.handleMessage(host, { t: 'solitaire', action: 'draw' });
    expect(room.solitaire?.state.waste).toHaveLength(1);
    expect(room.toPublic().solitaire?.moves).toBe(1);
    expect(guest.messages.some((message) => message.t === 'room')).toBe(true);
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
