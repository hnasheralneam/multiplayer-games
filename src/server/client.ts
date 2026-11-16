import type { WebSocket } from 'ws';
import type { Client as EngineClient } from '../shared/engine/client';

/** A WebSocket connection. The engine only sees the EngineClient half. */
export interface Client extends EngineClient {
  ip: string;
  socket: WebSocket;
  joinedAt: number;
}
