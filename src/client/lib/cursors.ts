import {
  useRef,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent
} from 'react';
import type { Avatar } from '../../shared/types';

export interface RemoteCursor {
  id: string;
  x: number;
  y: number;
  name: string;
  color: string;
  avatar: Avatar;
}

interface TrackedCursor {
  id: string;
  x: number;
  y: number;
  seen: number;
}

interface CursorPlayerInfo {
  name: string;
  color: string;
  avatar: Avatar;
}

let tracked = new Map<string, TrackedCursor>();
// Player identity comes from room state, not from cursor messages, so the
// wire only ever carries id + position.
let playerInfo = new Map<string, CursorPlayerInfo>();
let snapshot: RemoteCursor[] = [];
const listeners = new Set<() => void>();
let pruneTimer: ReturnType<typeof setInterval> | null = null;

function emit(): void {
  snapshot = [...tracked.values()]
    .map(({ seen: _seen, ...cursor }) => {
      const info = playerInfo.get(cursor.id);
      if (!info) return null;
      return { ...cursor, ...info };
    })
    .filter((cursor): cursor is RemoteCursor => cursor !== null);
  for (const listener of listeners) listener();
}

/** Feed the latest player list so cursors can be labelled without the wire carrying names. */
export function syncCursorPlayers(
  players: Array<{ id: string; name: string; color: string; avatar: Avatar }>
): void {
  playerInfo = new Map(
    players.map((player) => [
      player.id,
      { name: player.name, color: player.color, avatar: player.avatar }
    ])
  );
  if (tracked.size > 0) emit();
}

function ensurePruner(): void {
  if (pruneTimer) return;
  pruneTimer = setInterval(() => {
    const cutoff = Date.now() - 3000;
    let changed = false;
    for (const [id, cursor] of tracked) {
      if (cursor.seen < cutoff) {
        tracked.delete(id);
        changed = true;
      }
    }
    if (changed) emit();
    if (tracked.size === 0 && pruneTimer) {
      clearInterval(pruneTimer);
      pruneTimer = null;
    }
  }, 1200);
}

export function setCursor(cursor: { id: string; x: number; y: number }): void {
  const existing = tracked.get(cursor.id);
  const seen = Date.now();
  if (existing && existing.x === cursor.x && existing.y === cursor.y) {
    existing.seen = seen;
    return;
  }
  tracked.set(cursor.id, { ...cursor, seen });
  ensurePruner();
  emit();
}

export function removeCursor(id: string): void {
  if (tracked.delete(id)) emit();
}

export function retainCursors(ids: Iterable<string>): void {
  const keep = new Set(ids);
  let changed = false;
  for (const id of tracked.keys()) {
    if (!keep.has(id)) {
      tracked.delete(id);
      changed = true;
    }
  }
  if (changed) emit();
}

export function clearCursors(): void {
  tracked = new Map();
  playerInfo = new Map();
  if (pruneTimer) {
    clearInterval(pruneTimer);
    pruneTimer = null;
  }
  if (snapshot.length > 0) emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): RemoteCursor[] {
  return snapshot;
}

export interface CursorHandlers {
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerLeave: () => void;
}

/**
 * Normalize pointer positions against the element the handlers are attached to.
 * That element must be the same one the presence layer covers, otherwise remote
 * cursors drift by the layout around the board (padding, hints, centering).
 */
export function useCursorEmitter(
  onCursor: ((x: number, y: number) => void) | undefined,
  disabled = false
): CursorHandlers {
  const lastEmit = useRef(0);
  const lastCell = useRef('');

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (!onCursor || disabled || event.pointerType !== 'mouse') return;
    const stamp = performance.now();
    if (stamp - lastEmit.current < 100) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    // Quantize to a coarse grid so a drifting cursor only emits when it
    // crosses a cell-sized step, not on every pixel of movement.
    const qx = Math.round(x * 32) / 32;
    const qy = Math.round(y * 32) / 32;
    const cell = `${qx}:${qy}`;
    if (cell === lastCell.current) return;
    lastEmit.current = stamp;
    lastCell.current = cell;
    onCursor(qx, qy);
  };

  const onPointerLeave = () => {
    if (!onCursor || disabled) return;
    lastCell.current = '';
    onCursor(-1, -1);
  };

  return { onPointerMove, onPointerLeave };
}

export function useRemoteCursors(): RemoteCursor[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
