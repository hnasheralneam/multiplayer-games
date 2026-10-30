import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent
} from 'react';
import type { PublicRoom, You } from '../../shared/types';
import { formatClock } from '../lib/format';
import { Board } from './Board';
import { Hearts, useNow } from './ui';
import { IconClock, IconEye, IconFlag, IconMine } from './icons';
import { PlayerStrip } from './PlayerStrip';

export interface GameProps {
  room: PublicRoom;
  you: You;
  connected: boolean;
  serverOffset: number;
  recent: { cells: number[]; by: string; seq: number } | null;
  stale: { i: number; seq: number } | null;
  onReveal: (i: number) => void;
  onFlag: (i: number) => void;
  onChord: (i: number) => void;
  onCursor: (x: number, y: number) => void;
}

export function Game({
  room,
  you,
  connected,
  serverOffset,
  recent,
  stale,
  onReveal,
  onFlag,
  onChord,
  onCursor
}: GameProps) {
  const round = room.round;
  const now = useNow(200);
  const serverNow = now + serverOffset;
  const [mode, setMode] = useState<'reveal' | 'flag'>('reveal');
  const lastCursor = useRef(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState(0);

  useEffect(() => {
    setMode('reveal');
  }, [round?.id]);

  useLayoutEffect(() => {
    if (!round) return;
    const update = () => {
      const stage = stageRef.current;
      const stageWidth = stage?.clientWidth ?? window.innerWidth;
      const viewport = window.visualViewport?.height ?? window.innerHeight;
      const wide = round.width > round.height * 1.5;
      const chrome = window.innerWidth < 720 ? (wide ? 225 : 260) : wide ? 220 : 300;
      const maxHeight = Math.max(220, viewport - chrome);
      const widthCap = wide ? 2400 : 840;
      const next = Math.max(
        220,
        Math.min(stageWidth, widthCap, maxHeight * (round.width / round.height))
      );
      setBoardSize(next);
    };
    update();
    const observer = new ResizeObserver(update);
    if (stageRef.current) observer.observe(stageRef.current);
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, [round?.width, round?.height]);

  const players = useMemo(
    () => new Map(room.players.map((player) => [player.id, player])),
    [room.players]
  );
  const revealed = useMemo(
    () => new Map((round?.revealed ?? []).map((cell) => [cell.i, cell.n] as const)),
    [round?.revealed]
  );
  const flags = useMemo(
    () => new Map((round?.flags ?? []).map((flag) => [flag.i, flag.by] as const)),
    [round?.flags]
  );
  const mineResult = room.lastResult?.game === 'minesweeper' ? room.lastResult : null;
  const final = room.status === 'results' && Boolean(mineResult);
  const mines = useMemo(() => new Set(mineResult?.mines ?? []), [mineResult]);
  const recentMap = useMemo(() => {
    const map = new Map<number, string>();
    if (!recent) return map;
    const calm = 'rgba(94, 234, 212, 0.55)';
    for (const cell of recent.cells) map.set(cell, calm);
    return map;
  }, [recent]);

  if (!round) return null;

  const isWide = round.width > round.height * 1.5;
  const revealedMines = round.revealed.reduce(
    (count, cell) => count + (cell.n === -1 ? 1 : 0),
    0
  );
  const accountedMines = flags.size + revealedMines;
  const resuming = Boolean(room.resumeAt && serverNow < room.resumeAt);
  const canPlay = room.status === 'playing' && connected && !resuming && you.role === 'player';
  const disabled = !canPlay;
  const paused = Boolean(room.pausedAt) && room.status === 'playing';
  const elapsedMs =
    final && mineResult
      ? mineResult.durationMs
      : paused && room.pausedAt
        ? Math.max(0, room.pausedAt - round.startedAt)
        : room.status === 'playing'
          ? Math.max(0, serverNow - round.startedAt)
          : 0;
  const resumeIn = resuming && room.resumeAt ? Math.max(0, Math.ceil((room.resumeAt - serverNow) / 1000)) : 0;
  const firstClick = room.status === 'playing' && revealed.size === 0;

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!canPlay || event.pointerType !== 'mouse') return;
    const stamp = performance.now();
    if (stamp - lastCursor.current < 45) return;
    lastCursor.current = stamp;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    onCursor(x, y);
  };

  return (
    <section className={`game ${isWide ? 'game-big' : ''}`} aria-label="Game">
      <div className="game-hud">
        <div className="hud-group">
          {paused && <span className="live-pill">PAUSED</span>}
          <span className="hud-timer" aria-label={`Elapsed ${formatClock(elapsedMs / 1000)}`}>
            <IconClock size={16} />
            <strong>{formatClock(elapsedMs / 1000)}</strong>
          </span>
        </div>

        <div className="hud-center">
          <Hearts lives={round.lives} total={room.settings.lives} />
        </div>

        <div className="hud-group hud-right">
          <span
            className="flag-count"
            aria-label={`${accountedMines} of ${round.mines} mines accounted for: ${flags.size} ${flags.size === 1 ? 'flag' : 'flags'} placed and ${revealedMines} ${revealedMines === 1 ? 'mine' : 'mines'} hit`}
          >
            <IconFlag size={18} />
            <strong>{accountedMines}</strong>
            <span>/ {round.mines}</span>
          </span>
          {you.role === 'spectator' && (
            <span className="watching-pill">
              <IconEye size={14} /> Watching
            </span>
          )}
        </div>
      </div>

      <PlayerStrip players={room.players} you={you} />

      <div
        className={`board-stage ${final ? 'board-stage-final' : ''}`}
        ref={stageRef}
        style={{ '--board-size': boardSize ? `${boardSize}px` : undefined } as CSSProperties}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => {
          if (canPlay) onCursor(-1, -1);
        }}
      >
        <div className="board-holder">
          {firstClick && (
            <div className="first-click-hint">
              <IconMine size={16} /> First click is safe.
            </div>
          )}

          <Board
            key={round.id}
            width={round.width}
            height={round.height}
            revealed={revealed}
            flags={flags}
            players={players}
            meId={you.id}
            mode={mode}
            disabled={disabled}
            onReveal={onReveal}
            onFlag={onFlag}
            onChord={onChord}
            recent={recentMap}
            stale={stale?.i ?? null}
            mines={final ? mines : null}
            final={final}
          />
        </div>

        {resuming && (
          <div className="board-overlay resume-overlay">
            <span className="overlay-kicker">Players are back</span>
            <strong className="overlay-number">{resumeIn > 0 ? resumeIn : 'Go'}</strong>
            <span className="overlay-note">Resuming the board…</span>
          </div>
        )}

        {final && mineResult && (
          <div className={`end-flash ${mineResult.result === 'won' ? 'end-flash-win' : 'end-flash-loss'}`}>
            <span>{mineResult.result === 'won' ? 'Cleared.' : 'Boom.'}</span>
          </div>
        )}
      </div>

      <div className="game-controls">
        <div className="mode-switch" role="group" aria-label="Tap action">
          <button
            className={mode === 'reveal' ? 'mode-on' : ''}
            aria-pressed={mode === 'reveal'}
            onClick={() => setMode('reveal')}
            disabled={!canPlay}
          >
            Reveal
          </button>
          <button
            className={mode === 'flag' ? 'mode-on' : ''}
            aria-pressed={mode === 'flag'}
            onClick={() => setMode('flag')}
            disabled={!canPlay}
          >
            <IconFlag size={18} /> Flag
          </button>
        </div>
        <p className="game-hint">
          {you.role === 'spectator'
            ? 'Watching this round. You can join when a seat opens.'
            : mode === 'flag'
              ? 'Tap a hidden tile to flag it. Hold to flag from either mode.'
              : 'Tap to reveal · hold to flag · tap a number to chord.'}
        </p>
        <span className="game-progress" aria-label="Board progress">
          {Math.round((revealed.size / Math.max(1, round.width * round.height)) * 100)}% opened
        </span>
      </div>
    </section>
  );
}
