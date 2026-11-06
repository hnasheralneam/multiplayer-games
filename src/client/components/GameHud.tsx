import type { ReactNode } from 'react';
import { formatClock } from '../lib/format';
import { IconClock, IconX } from './icons';

export function GameHud({
  left,
  center,
  right
}: {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="game-hud">
      <div className="hud-side">{left}</div>
      <div className="hud-center">{center}</div>
      <div className="hud-side hud-right">{right}</div>
    </div>
  );
}

export function HudTimer({ seconds }: { seconds: number }) {
  return (
    <span className="hud-timer" aria-label={`Elapsed ${formatClock(seconds)}`}>
      <IconClock size={15} />
      <strong>{formatClock(seconds)}</strong>
    </span>
  );
}

export function HudMode({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <span className="hud-mode">
      {icon}
      {children}
    </span>
  );
}

export function HudEndGame({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="hud-end"
      onClick={onClick}
      aria-label="End this game for everyone"
    >
      <IconX size={13} /> End game
    </button>
  );
}
