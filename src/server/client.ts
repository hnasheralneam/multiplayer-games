import type { WebSocket } from 'ws';
import type { ServerMessage } from '../shared/types';

export interface Client {
  id: string;
  ip: string;
  socket: WebSocket;
  roomCode?: string;
  playerId?: string;
  role?: 'player' | 'spectator';
  joinedAt: number;
  send(message: ServerMessage): void;
  close(code?: number, reason?: string): void;
}
