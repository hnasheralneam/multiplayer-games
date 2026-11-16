import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import type { ClientMessage, ServerMessage } from '../../shared/types';
import { clearCursors } from './cursors';
import { createMessageHandler } from './roomMessages';
import {
  initialRoomState,
  roomReducer,
  type ConnectionState,
  type JoinIntent
} from './roomReducer';
import { loadToken, saveToken } from './storage';

export type { ConnectionState, JoinIntent };

function socketUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.host}/ws`;
}

export function useRoomSocket(code: string) {
  const [state, dispatch] = useReducer(roomReducer, initialRoomState);
  const socketRef = useRef<WebSocket | null>(null);
  const intentRef = useRef<JoinIntent | null>(null);
  const stoppedRef = useRef(false);
  const attemptRef = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const joinedRef = useRef(false);
  const toastSeq = useRef(0);
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

  const handleMessage = useMemo(
    () =>
      createMessageHandler({
        dispatch,
        schedule,
        toast,
        saveToken: (token) => {
          saveToken(code, token);
          if (intentRef.current) intentRef.current.token = token;
        },
        isJoined: () => joinedRef.current,
        onFatal: stop,
        onWelcome: () => {
          attemptRef.current = 0;
        }
      }),
    [code, dispatch, schedule, stop, toast]
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
        if (socketRef.current !== socket) return;
        if (typeof event.data !== 'string') return;
        let message: ServerMessage;
        try {
          message = JSON.parse(event.data) as ServerMessage;
        } catch {
          return;
        }
        handleMessage(message);
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
