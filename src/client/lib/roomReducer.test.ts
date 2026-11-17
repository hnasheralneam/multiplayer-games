import { describe, expect, it } from 'vitest';
import { roomReducer, initialRoomState, type RoomState } from './roomReducer';
import type { PublicRoom, RoundResult, You } from '../../shared/types';

const result: RoundResult = {
  game: 'minesweeper',
  result: 'won',
  endedAt: 1_000,
  durationMs: 500,
  livesLeft: 2,
  startingLives: 2,
  mines: [7],
  revealed: [{ i: 0, n: 0 }],
  flags: [{ i: 7, by: 'p1' }],
  stats: []
};

function room(overrides: Partial<PublicRoom> = {}): PublicRoom {
  return {
    code: 'K7QP',
    status: 'playing',
    hostId: 'p1',
    settings: {
      game: 'minesweeper',
      preset: 'cozy',
      width: 9,
      height: 9,
      mines: 10,
      lives: 2,
      maxPlayers: 8,
      lateJoin: true,
      sudokuDifficulty: 'medium',
      klondikeDraw: 1,
      mahjongLayout: 'turtle'
    },
    players: [],
    spectatorCount: 0,
    createdAt: 0,
    ...overrides
  };
}

function welcome(state: RoomState, publicRoom: PublicRoom): RoomState {
  const you: You = { id: 'p1', name: 'Maya', avatar: '🦊', color: '#ff7a59', role: 'player' };
  return roomReducer(state, { type: 'welcome', room: publicRoom, you, offset: 0 });
}

describe('roomReducer result retention', () => {
  it('keeps the result through lighter room messages during results', () => {
    let state = welcome(initialRoomState, room({ status: 'results', lastResult: result }));
    expect(state.room?.lastResult).toBeTruthy();

    state = roomReducer(state, { type: 'room', room: room({ status: 'results' }), offset: 0 });
    expect(state.room?.lastResult).toBeTruthy();
    expect(state.room?.status).toBe('results');
  });

  it('drops the result once the room leaves the results screen', () => {
    let state = welcome(initialRoomState, room({ status: 'results', lastResult: result }));
    state = roomReducer(state, { type: 'room', room: room({ status: 'lobby' }), offset: 0 });
    expect(state.room?.lastResult).toBeUndefined();
  });
});

describe('roomReducer mahjong deltas', () => {
  function playingMahjong() {
    return welcome(
      initialRoomState,
      room({
        mahjong: {
          id: 'm1',
          startedAt: 0,
          layout: 'cozy',
          tiles: [1, 2, 2, 1],
          moves: 0,
          shuffles: 0,
          selections: []
        }
      })
    );
  }

  it('applies a match and drops picks on the cleared tiles', () => {
    let state = playingMahjong();
    state = roomReducer(state, { type: 'mahjongSelect', by: 'p1', i: 2 });
    expect(state.room?.mahjong?.selections).toEqual([{ by: 'p1', i: 2 }]);

    state = roomReducer(state, { type: 'mahjongMatch', a: 0, b: 3 });
    expect(state.room?.mahjong?.tiles).toEqual([-1, 2, 2, -1]);
    expect(state.room?.mahjong?.moves).toBe(1);

    state = roomReducer(state, { type: 'mahjongMatch', a: 1, b: 2 });
    expect(state.room?.mahjong?.tiles).toEqual([-1, -1, -1, -1]);
    expect(state.room?.mahjong?.selections).toEqual([]);
  });

  it('replaces the stack on a shuffle', () => {
    let state = playingMahjong();
    state = roomReducer(state, { type: 'mahjongShuffle', tiles: [2, 1, 1, 2], shuffles: 1 });
    expect(state.room?.mahjong?.tiles).toEqual([2, 1, 1, 2]);
    expect(state.room?.mahjong?.shuffles).toBe(1);
  });
});
