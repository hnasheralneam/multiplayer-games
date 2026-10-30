import {
  memo,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent
} from 'react';
import type { PublicPlayer } from '../../shared/types';
import { useRemoteCursors } from '../lib/cursors';
import { haptic } from '../lib/copy';
import { classNames } from '../lib/format';
import { IconFlag, IconMine } from './icons';

export interface BoardProps {
  width: number;
  height: number;
  revealed: Map<number, number>;
  flags: Map<number, string>;
  players: Map<string, PublicPlayer>;
  meId?: string;
  mode: 'reveal' | 'flag';
  disabled: boolean;
  onReveal: (i: number) => void;
  onFlag: (i: number) => void;
  onChord: (i: number) => void;
  recent: Map<number, string>;
  stale: number | null;
  mines?: Set<number> | null;
  final?: boolean;
  showCursors?: boolean;
}

interface CellProps {
  i: number;
  row: number;
  col: number;
  value: number | undefined;
  flagged: boolean;
  flagColor?: string;
  mine: boolean;
  wrongFlag: boolean;
  mode: 'reveal' | 'flag';
  disabled: boolean;
  focused: boolean;
  recentColor?: string;
  stale: boolean;
  onActivate: (i: number) => void;
  onFlag: (i: number) => void;
  onFocus: (i: number) => void;
  onReveal: (i: number) => void;
}

const Cell = memo(function Cell({
  i,
  row,
  col,
  value,
  flagged,
  flagColor,
  mine,
  wrongFlag,
  mode,
  disabled,
  focused,
  recentColor,
  stale,
  onActivate,
  onFlag,
  onFocus,
  onReveal
}: CellProps) {
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  const clearTimer = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  useEffect(() => clearTimer, []);

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    didLongPress.current = false;
    if (event.pointerType === 'mouse') return;
    pressTimer.current = setTimeout(() => {
      pressTimer.current = null;
      didLongPress.current = true;
      onFlag(i);
      haptic(14);
    }, 340);
  };

  const onPointerUp = () => clearTimer();

  const handleClick = () => {
    if (disabled) return;
    if (didLongPress.current) {
      didLongPress.current = false;
      return;
    }
    onActivate(i);
  };

  const revealed = value !== undefined;
  const exploded = value === -1;
  const showMine = exploded || (mine && !revealed && !flagged);

  return (
    <button
      type="button"
      role="gridcell"
      className={classNames(
        'tile',
        revealed ? 'tile-open' : 'tile-hidden',
        flagged && 'tile-flagged',
        exploded && 'tile-exploded',
        mine && !revealed && !flagged && 'tile-mine-revealed',
        wrongFlag && 'tile-wrong',
        stale && 'tile-stale'
      )}
      style={
        {
          '--ring': recentColor ?? 'transparent',
          '--flag-color': flagColor ?? '#8b95a7'
        } as CSSProperties
      }
      aria-label={
        exploded
          ? `Row ${row + 1}, column ${col + 1}, mine`
          : revealed
            ? `Row ${row + 1}, column ${col + 1}, ${value} adjacent ${value === 1 ? 'mine' : 'mines'}`
            : `Row ${row + 1}, column ${col + 1}, hidden${flagged ? ', flagged' : ''}`
      }
      aria-disabled={disabled}
      tabIndex={focused ? 0 : -1}
      data-n={revealed && value > 0 ? value : undefined}
      data-index={i}
      onFocus={() => onFocus(i)}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={clearTimer}
      onPointerLeave={clearTimer}
      onClick={handleClick}
      onContextMenu={(event) => {
        event.preventDefault();
        if (!disabled && !revealed) onFlag(i);
      }}
      onDoubleClick={(event) => {
        event.preventDefault();
        if (!disabled && revealed && (value ?? 0) > 0) onActivate(i);
      }}
    >
      {showMine ? (
        <span className="tile-mine">
          <IconMine size={18} />
        </span>
      ) : flagged ? (
        <span className="tile-flag">
          <IconFlag size={18} />
          <i />
        </span>
      ) : revealed && value > 0 ? (
        <span className="tile-number">{value}</span>
      ) : null}
      {wrongFlag && <span className="tile-wrong-mark" aria-hidden="true">×</span>}
      {recentColor && <span className="tile-ring" aria-hidden="true" />}
      {!revealed && mode === 'flag' && !flagged && <span className="tile-mode-hint" aria-hidden="true" />}
    </button>
  );
});

function PresenceLayer() {
  const cursors = useRemoteCursors();
  return (
    <div className="presence-layer" aria-hidden="true">
      {cursors.map((cursor) => (
        <div
          className="remote-cursor"
          key={cursor.id}
          style={
            {
              left: `${cursor.x * 100}%`,
              top: `${cursor.y * 100}%`,
              '--c': cursor.color
            } as CSSProperties
          }
        >
          <svg viewBox="0 0 16 16" className="remote-cursor-arrow">
            <path d="M2 1.5 13.5 8 8.3 9.4 6.1 14.5 2 1.5Z" fill="currentColor" />
          </svg>
          <span className="remote-cursor-label">
            {cursor.avatar} {cursor.name}
          </span>
        </div>
      ))}
    </div>
  );
}

export const Board = memo(function Board({
  width,
  height,
  revealed,
  flags,
  players,
  meId,
  mode,
  disabled,
  onReveal,
  onFlag,
  onChord,
  recent,
  stale,
  mines,
  final = false,
  showCursors = true
}: BoardProps) {
  const [focusIndex, setFocusIndex] = useState(0);
  const boardRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const moveFocus = (next: number) => {
    const clamped = Math.max(0, Math.min(width * height - 1, next));
    setFocusIndex(clamped);
    cellRefs.current[clamped]?.focus();
  };

  const activate = (i: number) => {
    const value = revealed.get(i);
    if (value !== undefined) {
      if (value > 0) onChord(i);
      return;
    }
    if (flags.has(i)) {
      onFlag(i);
      return;
    }
    if (mode === 'flag') onFlag(i);
    else onReveal(i);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const key = event.key.toLowerCase();
    if (key === 'arrowleft') {
      event.preventDefault();
      moveFocus(focusIndex - 1);
    } else if (key === 'arrowright') {
      event.preventDefault();
      moveFocus(focusIndex + 1);
    } else if (key === 'arrowup') {
      event.preventDefault();
      moveFocus(focusIndex - width);
    } else if (key === 'arrowdown') {
      event.preventDefault();
      moveFocus(focusIndex + width);
    } else if (key === 'home') {
      event.preventDefault();
      moveFocus(focusIndex - (focusIndex % width));
    } else if (key === 'end') {
      event.preventDefault();
      moveFocus(focusIndex - (focusIndex % width) + width - 1);
    } else if (key === 'f') {
      event.preventDefault();
      if (!disabled && revealed.get(focusIndex) === undefined) onFlag(focusIndex);
    } else if (key === ' ' || key === 'enter') {
      event.preventDefault();
      if (!disabled) activate(focusIndex);
    }
  };

  return (
    <div className="board-frame">
      <div
        ref={boardRef}
        className={classNames('board', disabled && 'board-disabled')}
        style={{ '--cols': width, '--rows': height } as CSSProperties}
        role="grid"
        aria-label={`Minesweeper board, ${width} by ${height}`}
        aria-rowcount={height}
        aria-colcount={width}
        onKeyDown={onKeyDown}
      >
        {Array.from({ length: height }, (_, row) => (
          <div className="board-row" role="row" key={row}>
            {Array.from({ length: width }, (_, col) => {
              const i = row * width + col;
              const value = revealed.get(i);
              const owner = flags.get(i);
              const mine = Boolean(mines?.has(i));
              const wrongFlag = final && Boolean(owner) && !mine;
              return (
                <Cell
                  key={i}
                  i={i}
                  row={row}
                  col={col}
                  value={value}
                  flagged={owner !== undefined}
                  flagColor={owner ? players.get(owner)?.color : undefined}
                  mine={final && mine}
                  wrongFlag={wrongFlag}
                  mode={mode}
                  disabled={disabled}
                  focused={focusIndex === i}
                  recentColor={recent.get(i)}
                  stale={stale === i}
                  onActivate={activate}
                  onFlag={onFlag}
                  onFocus={setFocusIndex}
                  onReveal={onReveal}
                />
              );
            })}
          </div>
        ))}
      </div>
      {showCursors && <PresenceLayer />}
    </div>
  );
});
