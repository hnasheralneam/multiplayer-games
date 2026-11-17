import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import type { ClientMessage, ServerMessage } from '../../shared/types';
import type { Client } from '../../shared/engine/client';
import { newId } from '../../shared/engine/crypto';
import { Room, defaultSettings } from '../../shared/engine/room';
import { clearCursors } from './cursors';
import { createMessageHandler } from './roomMessages';
import {
  initialRoomState,
  roomReducer,
  type JoinIntent
} from './roomReducer';
import { loadToken, saveToken, type SoloRoom } from './storage';

export type { ConnectionState, JoinIntent } from './roomReducer';

/**
 * The room engine running inside the tab: same Room class as the server, but
 * messages cross a function call instead of a socket. Joining is instant and
 * nothing leaves the browser.
 */
export function useRoomLocal(code: string, solo: SoloRoom | null) {
  const [state, dispatch] = useReducer(roomReducer, initialRoomState);
  const roomRef = useRef<Room | null>(null);
  const clientRef = useRef<Client | null>(null);
  const stoppedRef = useRef(true);
  const joinedRef = useRef(false);
  const toastSeq = useRef(0);
  const clearTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const deliverRef = useRef<(message: ServerMessage) => void>(() => undefined);

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
    const room = roomRef.current;
    roomRef.current = null;
    clientRef.current = null;
    if (room) room.destroy('This room closed.');
  }, []);

  const handleMessage = useMemo(
    () =>
      createMessageHandler({
        dispatch,
        schedule,
        toast,
        saveToken: (token) => saveToken(code, token),
        isJoined: () => joinedRef.current,
        onFatal: stop
      }),
    [code, dispatch, schedule, stop, toast]
  );

  deliverRef.current = (message: ServerMessage) => {
    if (stoppedRef.current) return;
    handleMessage(message);
  };

  const connect = useCallback(
    (intent: JoinIntent) => {
      stoppedRef.current = false;
      if (!roomRef.current) {
        const settings = defaultSettings();
        if (solo?.game) settings.game = solo.game;
        roomRef.current = new Room(code, settings, null, () => undefined, { solo: true });
        clientRef.current = {
          id: newId(),
          send: (message) => deliverRef.current(message),
          close: () => undefined
        };
      }
      dispatch({ type: 'clearFatal' });
      dispatch({ type: 'connection', value: 'connecting' });
      roomRef.current.handleJoin(clientRef.current!, {
        t: 'join',
        code,
        name: intent.name,
        avatar: intent.avatar,
        token: intent.token ?? loadToken(code) ?? undefined
      });
    },
    [code, solo?.game]
  );

  const send = useCallback((message: Exclude<ClientMessage, { t: 'join' }>) => {
    if (stoppedRef.current || !joinedRef.current) return;
    const room = roomRef.current;
    const client = clientRef.current;
    if (!room || !client) return;
    room.handleMessage(client, message);
  }, []);

  const disconnect = useCallback(() => {
    stop();
    dispatch({ type: 'connection', value: 'closed' });
  }, [stop]);

  useEffect(() => {
    return () => {
      stoppedRef.current = true;
      for (const timer of clearTimers.current) clearTimeout(timer);
      clearTimers.current.clear();
      const room = roomRef.current;
      roomRef.current = null;
      clientRef.current = null;
      if (room) room.destroy('');
      clearCursors();
    };
  }, []);

  return { state, connect, send, disconnect };
}
