import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { formatClock } from '../lib/format';
import { IconClock } from './icons';

/**
 * The top bar in RoomChrome owns a centered slot (game stats) and a right
 * slot (end game); every game renders its HUD through <GameHud>, which
 * portals into those slots and so becomes part of the one top bar.
 */
export interface HudSlots {
  center: HTMLElement | null;
  side: HTMLElement | null;
}

export const HudSlotContext = createContext<HudSlots>({ center: null, side: null });

export function GameHud({
  left,
  center,
  right
}: {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
}) {
  const slots = useContext(HudSlotContext);
  if (!slots.center || !slots.side) return null;
  return (
    <>
      {createPortal(
        <>
          <div className="hud-side">{left}</div>
          <div className="hud-center">{center}</div>
        </>,
        slots.center
      )}
      {createPortal(<div className="hud-side hud-right">{right}</div>, slots.side)}
    </>
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
      End game
    </button>
  );
}
