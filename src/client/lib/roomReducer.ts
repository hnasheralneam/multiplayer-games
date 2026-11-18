import { applySolitaireMoves } from '../../shared/solitaire';
import type { Avatar, GameKind, PublicRoom, SolitaireCardMove, You } from '../../shared/types';

export interface JoinIntent {
  name: string;
  avatar: Avatar;
  token?: string;
  spectate?: boolean;
  game?: GameKind;
}

export type ConnectionState = 'idle' | 'connecting' | 'reconnecting' | 'open' | 'closed';

export interface Toast {
  message: string;
  seq: number;
}

export interface RoomState {
  connection: ConnectionState;
  joined: boolean;
  room: PublicRoom | null;
  you: You | null;
  serverOffset: number;
  notice: string | null;
  fatal: { code: string; message: string } | null;
  joinError: { code: string; message: string } | null;
  toast: Toast | null;
  recent: { cells: number[]; by: string; seq: number } | null;
  stale: { i: number; seq: number } | null;
  sudokuRecent: { i: number; seq: number } | null;
}

export type RoomAction =
  | { type: 'connection'; value: ConnectionState }
  | {
      type: 'welcome';
      room: PublicRoom;
      you: You;
      offset: number;
      notice?: string;
    }
  | { type: 'room'; room: PublicRoom; offset: number }
  | { type: 'cells'; cells: Array<{ i: number; n: number }>; by: string; seq: number }
  | { type: 'flag'; i: number; on: boolean; by: string }
  | { type: 'life'; lives: number }
  | { type: 'recentClear'; seq: number }
  | { type: 'stale'; i: number; seq: number }
  | { type: 'staleClear'; seq: number }
  | { type: 'sudokuCell'; i: number; digit: number; by: string; wrong: boolean; seq: number }
  | { type: 'sudokuRecentClear'; seq: number }
  | { type: 'solitaireMove'; moves: SolitaireCardMove[]; totalMoves: number; passes: number; canUndo: boolean }
  | { type: 'mahjongMatch'; a: number; b: number }
  | { type: 'mahjongSelect'; by: string; i: number | null }
  | { type: 'mahjongShuffle'; tiles: number[]; shuffles: number }
  | { type: 'joinError'; code: string; message: string }
  | { type: 'fatal'; code: string; message: string }
  | { type: 'clearFatal'; }
  | { type: 'toast'; message: string; seq: number }
  | { type: 'toastClear'; seq: number };

export const initialRoomState: RoomState = {
  connection: 'idle',
  joined: false,
  room: null,
  you: null,
  serverOffset: 0,
  notice: null,
  fatal: null,
  joinError: null,
  toast: null,
  recent: null,
  stale: null,
  sudokuRecent: null
};

export function mergeCells(
  room: PublicRoom,
  cells: Array<{ i: number; n: number }>
): PublicRoom {
  if (!room.round) return room;
  const merged = new Map(room.round.revealed.map((cell) => [cell.i, cell] as const));
  for (const cell of cells) merged.set(cell.i, cell);
  return {
    ...room,
    round: {
      ...room.round,
      revealed: [...merged.values()].sort((a, b) => a.i - b.i)
    }
  };
}

export function roomReducer(state: RoomState, action: RoomAction): RoomState {
  switch (action.type) {
    case 'connection':
      return { ...state, connection: action.value };
    case 'welcome':
      return {
        ...state,
        connection: 'open',
        joined: true,
        room: action.room,
        you: action.you,
        serverOffset: action.offset,
        notice: action.notice ?? null,
        fatal: null,
        joinError: null,
        recent: null,
        stale: null,
        sudokuRecent: null
      };
    case 'room': {
      const currentYou = state.you;
      let you = currentYou;
      if (currentYou?.role === 'player') {
        const me = action.room.players.find((player) => player.id === currentYou.id);
        if (me) {
          you = { ...currentYou, name: me.name, avatar: me.avatar, color: me.color };
        }
      }
      const roundChanged = action.room.round?.id !== state.room?.round?.id;
      const sudokuChanged = action.room.sudoku?.id !== state.room?.sudoku?.id;
      // The result is broadcast once, when the round ends. Later room
      // messages during the results screen omit it, so keep the local copy.
      const lastResult =
        action.room.lastResult ??
        (action.room.status === 'results' ? state.room?.lastResult : undefined);
      return {
        ...state,
        room: { ...action.room, lastResult },
        you,
        serverOffset: action.offset,
        connection: 'open',
        joined: true,
        recent: roundChanged ? null : state.recent,
        stale: roundChanged ? null : state.stale,
        sudokuRecent: sudokuChanged ? null : state.sudokuRecent
      };
    }
    case 'cells':
      if (!state.room?.round) return state;
      return {
        ...state,
        room: mergeCells(state.room, action.cells),
        recent: {
          cells: action.cells.map((cell) => cell.i),
          by: action.by,
          seq: action.seq
        }
      };
    case 'flag': {
      if (!state.room?.round) return state;
      const flags = state.room.round.flags.filter((flag) => flag.i !== action.i);
      if (action.on) flags.push({ i: action.i, by: action.by });
      flags.sort((a, b) => a.i - b.i);
      return {
        ...state,
        room: { ...state.room, round: { ...state.room.round, flags } }
      };
    }
    case 'life':
      if (!state.room?.round) return state;
      return {
        ...state,
        room: {
          ...state.room,
          round: { ...state.room.round, lives: action.lives }
        }
      };
    case 'recentClear':
      if (state.recent?.seq !== action.seq) return state;
      return { ...state, recent: null };
    case 'stale':
      return { ...state, stale: { i: action.i, seq: action.seq } };
    case 'sudokuCell': {
      if (!state.room?.sudoku) return state;
      const entries = state.room.sudoku.entries.filter((entry) => entry.i !== action.i);
      if (action.digit !== 0) {
        entries.push({
          i: action.i,
          digit: action.digit,
          by: action.by,
          wrong: action.wrong
        });
      }
      entries.sort((a, b) => a.i - b.i);
      return {
        ...state,
        room: { ...state.room, sudoku: { ...state.room.sudoku, entries } },
        sudokuRecent: { i: action.i, seq: action.seq }
      };
    }
    case 'sudokuRecentClear':
      if (state.sudokuRecent?.seq !== action.seq) return state;
      return { ...state, sudokuRecent: null };
    case 'solitaireMove': {
      if (!state.room?.solitaire) return state;
      const solitaire = applySolitaireMoves(state.room.solitaire, action.moves);
      return {
        ...state,
        room: {
          ...state.room,
          solitaire: {
            ...solitaire,
            moves: action.totalMoves,
            passes: action.passes,
            canUndo: action.canUndo
          }
        }
      };
    }
    case 'mahjongMatch': {
      if (!state.room?.mahjong) return state;
      const mahjong = state.room.mahjong;
      const tiles = [...mahjong.tiles];
      tiles[action.a] = -1;
      tiles[action.b] = -1;
      return {
        ...state,
        room: {
          ...state.room,
          mahjong: {
            ...mahjong,
            tiles,
            moves: mahjong.moves + 1,
            selections: mahjong.selections.filter(
              (selection) => selection.i !== action.a && selection.i !== action.b
            )
          }
        }
      };
    }
    case 'mahjongSelect': {
      if (!state.room?.mahjong) return state;
      const mahjong = state.room.mahjong;
      const selections = mahjong.selections.filter((selection) => selection.by !== action.by);
      if (action.i !== null) selections.push({ by: action.by, i: action.i });
      return {
        ...state,
        room: { ...state.room, mahjong: { ...mahjong, selections } }
      };
    }
    case 'mahjongShuffle': {
      if (!state.room?.mahjong) return state;
      return {
        ...state,
        room: {
          ...state.room,
          mahjong: { ...state.room.mahjong, tiles: action.tiles, shuffles: action.shuffles }
        }
      };
    }
    case 'staleClear':
      if (state.stale?.seq !== action.seq) return state;
      return { ...state, stale: null };
    case 'joinError':
      return {
        ...state,
        joined: false,
        joinError: { code: action.code, message: action.message },
        connection: 'idle'
      };
    case 'fatal':
      return {
        ...state,
        fatal: { code: action.code, message: action.message },
        joinError: null,
        joined: false,
        connection: 'closed'
      };
    case 'clearFatal':
      return { ...state, fatal: null, joinError: null };
    case 'toast':
      return { ...state, toast: { message: action.message, seq: action.seq } };
    case 'toastClear':
      if (state.toast?.seq !== action.seq) return state;
      return { ...state, toast: null };
    default:
      return state;
  }
}
