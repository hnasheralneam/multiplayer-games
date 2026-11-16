import type { ErrorCode, ServerMessage } from '../../shared/types';
import { removeCursor, retainCursors, setCursor } from './cursors';
import type { RoomAction } from './roomReducer';

/**
 * Everything a transport (WebSocket or in-tab) must provide so the shared
 * server-message logic can run. `code` is the room this handler belongs to.
 */
export interface MessageContext {
  dispatch: (action: RoomAction) => void;
  schedule: (fn: () => void, ms: number) => void;
  toast: (message: string) => void;
  saveToken: (token: string) => void;
  isJoined: () => boolean;
  /** The room ended for good (closed, kicked, replaced). Tear the transport down. */
  onFatal: () => void;
  /** Called on a successful welcome; the socket transport resets its backoff. */
  onWelcome?: () => void;
}

/**
 * Applies one ServerMessage to room state. Shared by the socket transport and
 * the local engine, so both speak the exact same protocol.
 */
export function createMessageHandler(ctx: MessageContext): (message: ServerMessage) => void {
  let recentSeq = 0;
  let staleSeq = 0;

  return function handleMessage(message: ServerMessage): void {
    switch (message.t) {
      case 'welcome': {
        if (message.token) ctx.saveToken(message.token);
        ctx.onWelcome?.();
        ctx.dispatch({
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
        ctx.dispatch({
          type: 'room',
          room: message.room,
          offset: message.serverNow - Date.now()
        });
        retainCursors(message.room.players.map((player) => player.id));
        break;
      }
      case 'cells': {
        recentSeq += 1;
        const seq = recentSeq;
        ctx.dispatch({ type: 'cells', cells: message.cells, by: message.by, seq });
        ctx.schedule(() => ctx.dispatch({ type: 'recentClear', seq }), 650);
        break;
      }
      case 'flag':
        ctx.dispatch({ type: 'flag', i: message.i, on: message.on, by: message.by });
        break;
      case 'life':
        ctx.dispatch({ type: 'life', lives: message.lives });
        break;
      case 'stale': {
        staleSeq += 1;
        const seq = staleSeq;
        ctx.dispatch({ type: 'stale', i: message.i, seq });
        ctx.schedule(() => ctx.dispatch({ type: 'staleClear', seq }), 360);
        break;
      }
      case 'sudokuCell': {
        recentSeq += 1;
        const seq = recentSeq;
        ctx.dispatch({
          type: 'sudokuCell',
          i: message.i,
          digit: message.digit,
          by: message.by,
          wrong: message.wrong,
          seq
        });
        ctx.schedule(() => ctx.dispatch({ type: 'sudokuRecentClear', seq }), 550);
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
        ctx.dispatch({ type: 'fatal', code: 'closed', message: message.message });
        ctx.onFatal();
        break;
      case 'error': {
        const errorCode: ErrorCode = message.code;
        if (errorCode === 'not_found' || errorCode === 'replaced' || errorCode === 'kicked') {
          ctx.dispatch({ type: 'fatal', code: errorCode, message: message.message });
          ctx.onFatal();
          break;
        }
        if (errorCode === 'closed') {
          ctx.dispatch({ type: 'fatal', code: errorCode, message: message.message });
          ctx.onFatal();
          break;
        }
        if (!ctx.isJoined() && (errorCode === 'full' || errorCode === 'rate_limited')) {
          ctx.dispatch({ type: 'joinError', code: errorCode, message: message.message });
          break;
        }
        ctx.toast(message.message);
        break;
      }
      default:
        break;
    }
  };
}
