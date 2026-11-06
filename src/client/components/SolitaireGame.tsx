import { useEffect, useState } from 'react';
import { GAME_META, type PublicRoom, type SolitaireSlot, type You } from '../../shared/types';
import { GameHud, HudEndGame, HudMode, HudTimer } from './GameHud';
import { StatusPill, useNow } from './ui';
import { GameIcon } from './GameIcon';
import { PlayerStrip } from './PlayerStrip';
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
  onCursor,
  onEndGame
}: SolitaireGameProps) {
  const solitaire = room.solitaire;
  const now = useNow(200);
  const serverNow = now + serverOffset;
  const [selected, setSelected] = useState<number | null>(null);

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

  const solverStatus = useSolitaireSolver(solitaire, room.status === 'playing');

  if (!solitaire) return null;  const meta = GAME_META[solitaire.variant];
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
            {onEndGame && you.id === room.hostId && <HudEndGame onClick={onEndGame} />}
          </>
        }
      />

      <PlayerStrip players={room.players} you={you} />

      <div className="solitaire-layout">
        <div className="solitaire-stage">
          <SolitaireBoard
            solitaire={solitaire}
            selected={selected}
            disabled={!canPlay}
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
