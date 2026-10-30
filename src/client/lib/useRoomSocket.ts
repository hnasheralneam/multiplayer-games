import { useCallback, useEffect, useReducer, useRef } from 'react';
import type {
  Avatar,
  ClientMessage,
  ErrorCode,
  PublicRoom,
  ServerMessage,
  You
} from '../../shared/types';
import { clearCursors, removeCursor, retainCursors, setCursor } from './cursors';
import { loadToken, saveToken } from './storage';

export interface JoinIntent {
  name: string;
  avatar: Avatar;
  token?: string;
  spectate?: boolean;
}

export type ConnectionState = 'idle' | 'connecting' | 'reconnecting' | 'open' | 'closed';

interface Toast {
  message: string;
  seq: number;
}

interface State {
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

type Action =
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
  | { type: 'joinError'; code: string; message: string }
  | { type: 'fatal'; code: string; message: string }
  | { type: 'clearFatal' }
  | { type: 'toast'; message: string; seq: number }
  | { type: 'toastClear'; seq: number };

const initialState: State = {
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

function mergeCells(
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

function reducer(state: State, action: Action): State {
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
      return {
        ...state,
        room: action.room,
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

function socketUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.host}/ws`;
}

export function useRoomSocket(code: string) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const socketRef = useRef<WebSocket | null>(null);
  const intentRef = useRef<JoinIntent | null>(null);
  const stoppedRef = useRef(false);
  const attemptRef = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recentSeq = useRef(0);
  const staleSeq = useRef(0);
  const toastSeq = useRef(0);
  const joinedRef = useRef(false);
  const clearTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    joinedRef.current = state.joined;
  }, [state.joined]);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const timer = setTimeout(() => {
      clearTimers.current.delete(timer);
      fn();
    }, ms);
    clearTimers.current.add(timer);
  }, []);

  const toast = useCallback(
    (message: string) => {
      toastSeq.current += 1;
      const seq = toastSeq.current;
      dispatch({ type: 'toast', message, seq });
      schedule(() => dispatch({ type: 'toastClear', seq }), 3200);
    },
    [schedule]
  );

  const stop = useCallback(() => {
    stoppedRef.current = true;
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    reconnectTimer.current = null;
    const socket = socketRef.current;
    socketRef.current = null;
    if (socket) {
      socket.onclose = null;
      socket.close();
    }
  }, []);

  const handleMessage = useCallback(
    (raw: string, socket: WebSocket) => {
      if (socketRef.current !== socket) return;
      let message: ServerMessage;
      try {
        message = JSON.parse(raw) as ServerMessage;
      } catch {
        return;
      }
      switch (message.t) {
        case 'welcome': {
          if (message.token) {
            saveToken(code, message.token);
            if (intentRef.current) intentRef.current.token = message.token;
          }
          attemptRef.current = 0;
          dispatch({
            type: 'welcome',
            room: message.room,
            you: message.you,
            offset: message.serverNow - Date.now(),
            notice: message.notice
          });
          retainCursors(message.room.players.map((player) => player.id));
          break;
        }
        case 'room': {
          dispatch({
            type: 'room',
            room: message.room,
            offset: message.serverNow - Date.now()
          });
          retainCursors(message.room.players.map((player) => player.id));
          break;
        }
        case 'cells': {
          recentSeq.current += 1;
          const seq = recentSeq.current;
          dispatch({ type: 'cells', cells: message.cells, by: message.by, seq });
          schedule(() => dispatch({ type: 'recentClear', seq }), 650);
          break;
        }
        case 'flag':
          dispatch({ type: 'flag', i: message.i, on: message.on, by: message.by });
          break;
        case 'life':
          dispatch({ type: 'life', lives: message.lives });
          break;
        case 'stale': {
          staleSeq.current += 1;
          const seq = staleSeq.current;
          dispatch({ type: 'stale', i: message.i, seq });
          schedule(() => dispatch({ type: 'staleClear', seq }), 360);
          break;
        }
        case 'sudokuCell': {
          recentSeq.current += 1;
          const seq = recentSeq.current;
          dispatch({
            type: 'sudokuCell',
            i: message.i,
            digit: message.digit,
            by: message.by,
            wrong: message.wrong,
            seq
          });
          schedule(() => dispatch({ type: 'sudokuRecentClear', seq }), 550);
          break;
        }
        case 'cursor':
          if (message.leave || message.x < 0 || message.y < 0) {
            removeCursor(message.id);
          } else {
            setCursor({
              id: message.id,
              x: message.x,
              y: message.y,
              name: message.name,
              color: message.color,
              avatar: message.avatar
            });
          }
          break;
        case 'closed':
          dispatch({ type: 'fatal', code: 'closed', message: message.message });
          stop();
          break;
        case 'error': {
          const errorCode: ErrorCode = message.code;
          if (errorCode === 'not_found' || errorCode === 'replaced' || errorCode === 'kicked') {
            dispatch({ type: 'fatal', code: errorCode, message: message.message });
            stop();
            break;
          }
          if (errorCode === 'closed') {
            dispatch({ type: 'fatal', code: errorCode, message: message.message });
            stop();
            break;
          }
          if (!joinedRef.current && (errorCode === 'full' || errorCode === 'rate_limited')) {
            dispatch({ type: 'joinError', code: errorCode, message: message.message });
            break;
          }
          toast(message.message);
          break;
        }
        default:
          break;
      }
    },
    [code, schedule, stop, toast]
  );

  const doConnect = useCallback(
    (attempt: number) => {
      if (stoppedRef.current || !intentRef.current) return;
      const previous = socketRef.current;
      if (previous) {
        previous.onclose = null;
        previous.close();
      }
      let socket: WebSocket;
      try {
        socket = new WebSocket(socketUrl());
      } catch {
        toast('Could not open a connection. Reload and try again.');
        return;
      }
      socketRef.current = socket;
      dispatch({ type: 'connection', value: attempt === 0 ? 'connecting' : 'reconnecting' });

      socket.onopen = () => {
        if (socketRef.current !== socket) return;
        const intent = intentRef.current;
        if (!intent) return;
        socket.send(
          JSON.stringify({
            t: 'join',
            code,
            name: intent.name,
            avatar: intent.avatar,
            token: intent.token,
            spectate: intent.spectate
          })
        );
      };

      socket.onmessage = (event) => {
        if (typeof event.data === 'string') handleMessage(event.data, socket);
      };

      socket.onclose = (event) => {
        if (socketRef.current !== socket) return;
        socketRef.current = null;
        if (stoppedRef.current) return;
        if (event.code === 4001) {
          dispatch({
            type: 'fatal',
            code: 'replaced',
            message: 'You opened this room in another tab.'
          });
          stop();
          return;
        }
        if (event.code === 4002) {
          dispatch({
            type: 'fatal',
            code: 'kicked',
            message: 'The host removed you from this room.'
          });
          stop();
          return;
        }
        if (event.code === 4003) {
          dispatch({ type: 'fatal', code: 'closed', message: 'This room closed.' });
          stop();
          return;
        }
        dispatch({ type: 'connection', value: 'reconnecting' });
        attemptRef.current += 1;
        const delay = Math.min(500 * 2 ** Math.min(attemptRef.current, 4), 5000);
        if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
        reconnectTimer.current = setTimeout(() => doConnect(attemptRef.current), delay);
      };

      socket.onerror = () => {
      };
    },
    [code, handleMessage, stop, toast]
  );

  const connect = useCallback(
    (intent: JoinIntent) => {
      stoppedRef.current = false;
      attemptRef.current = 0;
      intentRef.current = {
        ...intent,
        token: intent.token ?? loadToken(code) ?? undefined
      };
      dispatch({ type: 'clearFatal' });
      doConnect(0);
    },
    [code, doConnect]
  );

  const send = useCallback((message: Exclude<ClientMessage, { t: 'join' }>) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN || !joinedRef.current) return;
    socket.send(JSON.stringify(message));
  }, []);

  const disconnect = useCallback(() => {
    stop();
    dispatch({ type: 'connection', value: 'closed' });
  }, [stop]);

  useEffect(() => {
    const wake = () => {
      if (
        document.visibilityState === 'visible' &&
        !stoppedRef.current &&
        !socketRef.current &&
        intentRef.current
      ) {
        attemptRef.current = 0;
        doConnect(0);
      }
    };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', wake);
    return () => {
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', wake);
    };
  }, [doConnect]);

  useEffect(() => {
    return () => {
      stoppedRef.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      for (const timer of clearTimers.current) clearTimeout(timer);
      clearTimers.current.clear();
      const socket = socketRef.current;
      socketRef.current = null;
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
      clearCursors();
    };
  }, []);

  return { state, connect, send, disconnect };
}
