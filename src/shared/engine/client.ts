import type { ServerMessage } from '../types';

/**
 * A connected seat as the room engine sees it: an id, a join slot, and two
 * callbacks. Any transport can implement this — a WebSocket on the server,
 * a plain function pair in a solo tab.
 */
export interface Client {
  id: string;
  roomCode?: string;
  playerId?: string;
  role?: 'player' | 'spectator';
  send(message: ServerMessage): void;
  close(code?: number, reason?: string): void;
}
