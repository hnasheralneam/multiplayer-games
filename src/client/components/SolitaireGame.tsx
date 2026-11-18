import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { GAME_META, type PublicRoom, type SolitaireSlot, type You } from '../../shared/types';
import { GameHud, HudEndGame, HudMode, HudTimer } from './GameHud';
import { StatusPill, useNow } from './ui';
import { GameIcon } from './GameIcon';
import { IconUndo } from './icons';
import { useSolitaireSolver } from '../lib/useSolitaireSolver';
import { SolitaireBoard } from './SolitaireBoard';

export interface SolitaireGameProps {
  room: PublicRoom;
  you: You;
  connected: boolean;
  serverOffset: number;
  onDraw: () => void;
  onRecycle: () => void;
  onMove: (card: number, to: SolitaireSlot) => void;
  onAuto: (card: number) => void;
  onUndo: () => void;
  onCursor: (x: number, y: number) => void;
  onEndGame?: () => void;
}

function cardsHome(foundations: number[][]): number {
  return foundations.reduce((total, pile) => total + pile.length, 0);
}

export function SolitaireGame({
  room,
  you,
  connected,
  serverOffset,
  onDraw,
  onRecycle,
  onMove,
  onAuto,
  onUndo,
  onCursor,
  onEndGame
}: SolitaireGameProps) {
  const solitaire = room.solitaire;
  const now = useNow(200);
  const serverNow = now + serverOffset;
  const [selected, setSelected] = useState<number | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [fit, setFit] = useState<{ card: number; fanRoom: number } | null>(null);

  useEffect(() => {
    setSelected(null);
  }, [solitaire?.id]);

  useEffect(() => {
    if (!solitaire || selected === null) return;
    const present =
      solitaire.tableau.some((column) => column.includes(selected)) ||
      solitaire.waste.includes(selected) ||
      solitaire.freeCells.includes(selected) ||
      solitaire.foundations.some((pile) => pile.includes(selected));
    if (!present) setSelected(null);
  }, [solitaire, selected]);

  // One size per round: the table is dealt with a 7-card run on its tallest
  // column (Klondike and FreeCell alike), so its fixed-ratio board spans
  // 1.64 card widths above the columns and 4.4 inside them — 6.04 total (see
  // .solitaire-board).Cards stay at the size that fit the deal for the whole
  // round; a column that grows deeper compresses its own fan instead of
  // pushing cards smaller (the classic solitaire squeeze).
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const update = () => {
      const stageTop = stage.getBoundingClientRect().top + window.scrollY;
      const viewportH = window.visualViewport?.height ?? window.innerHeight;
      // Space left of the stage's own chrome: its padding and border sit
      // between the board and the stage box, and the page keeps 48px further
      // down under the table.
      const available = Math.max(260, viewportH - stageTop - 83);
      const card = Math.max(30, Math.floor(available / 6.04));
      setFit((prev) => {
        const fanRoom = available / card - 3.04;
        if (prev && prev.card === card && Math.abs(prev.fanRoom - fanRoom) < 0.005) return prev;
        return { card, fanRoom };
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, []);

  const solverStatus = useSolitaireSolver(solitaire, room.status === 'playing');

  if (!solitaire) return null;
  const meta = GAME_META[solitaire.variant];
  const resuming = Boolean(room.resumeAt && serverNow < room.resumeAt);
  const canPlay =
    connected && room.status === 'playing' && you.role === 'player' && !resuming;
  const paused = Boolean(room.pausedAt) && room.status === 'playing';
  const endedAt = solitaire.endedAt ?? serverNow;
  const elapsed = Math.max(0, endedAt - solitaire.startedAt);
  const home = cardsHome(solitaire.foundations);
  const final =
    room.status === 'results' &&
    (room.lastResult?.game === solitaire.variant);

  return (
    <section className={`solitaire-game ${final ? 'solitaire-game-final' : ''}`} aria-label={meta.label}>
      <GameHud
        left={
          <>
            {paused && <span className="live-pill">PAUSED</span>}
            <HudTimer seconds={elapsed / 1000} />
            <HudMode icon={<GameIcon game={solitaire.variant} size={14} />}>
              {meta.label}
              {solitaire.variant === 'klondike' && ` · draw ${solitaire.draw}`}
            </HudMode>
          </>
        }
        center={
          <span className="hud-progress" aria-live="polite">
            <strong>{home}</strong>
            <span>/ 52 home</span>
            {solitaire.moves > 0 && <em>{solitaire.moves} moves</em>}
          </span>
        }
        right={
          <>
            <span>
              {solitaire.passes > 0
                ? `${solitaire.passes} pass${solitaire.passes === 1 ? '' : 'es'}`
                : 'Unlimited passes'}
            </span>
            <button
              type="button"
              className="hud-undo"
              onClick={onUndo}
              disabled={!canPlay || !solitaire.canUndo}
              aria-label="Undo the last move for everyone"
            >
              <IconUndo size={13} /> Undo
            </button>
            {onEndGame && you.id === room.hostId && <HudEndGame onClick={onEndGame} />}
          </>
        }
      />

      <div className="solitaire-layout">
        <div
          className="solitaire-stage"
          ref={stageRef}
          style={fit ? ({ '--card-size': `${fit.card}px` } as CSSProperties) : undefined}
        >
          <SolitaireBoard
            solitaire={solitaire}
            selected={selected}
            disabled={!canPlay}
            fanRoom={fit ? fit.fanRoom : null}
            onSelect={setSelected}
            onMove={onMove}
            onDraw={onDraw}
            onRecycle={onRecycle}
            onAuto={onAuto}
            onCursor={onCursor}
          />

          {resuming && (
            <div className="solitaire-overlay">
              <span>Table resuming…</span>
            </div>
          )}
          {final && (
            <div className="solitaire-overlay solitaire-solved">
              <span>Solved.</span>
            </div>
          )}
        </div>

        <aside className="solitaire-side" aria-label="Solitaire help">
          <span className="solitaire-side-kicker">How to move</span>
          <p className="solitaire-help">
            Drag a card — or a run — where it goes. Double-tap a card to send it straight to its
            foundation. Safe cards climb up on their own.
          </p>
          <div className="solitaire-legend">
            <span><i className="legend-dot legend-given" /> foundations build up</span>
            <span><i className="legend-dot legend-entry" /> tableau builds down</span>
            {solitaire.variant === 'klondike' ? (
              <span><i className="legend-dot legend-wrong" /> kings start empty columns</span>
            ) : (
              <span><i className="legend-dot legend-wrong" /> free cells hold one card</span>
            )}
          </div>
          <div className="solitaire-side-stats">
            <div>
              <span>Moves</span>
              <strong>{solitaire.moves}</strong>
            </div>
            <div>
              <span>Home</span>
              <strong>{home}/52</strong>
            </div>
            <div>
              <span>Solver</span>
              {solverStatus === 'solvable' && <StatusPill tone="success">Solvable</StatusPill>}
              {solverStatus === 'unsolvable' && <StatusPill tone="live">Stuck</StatusPill>}
              {solverStatus === 'checking' && <StatusPill tone="neutral">Checking…</StatusPill>}
              {solverStatus === 'unsure' && <StatusPill tone="neutral">Unsure</StatusPill>}
              {solverStatus === 'idle' && <StatusPill tone="neutral">—</StatusPill>}
            </div>
          </div>
          <p className="solitaire-help solitaire-help-shared">
            One shared table, no turns. Everyone in the room can pick up the next card.
          </p>
        </aside>
      </div>
    </section>
  );
}
