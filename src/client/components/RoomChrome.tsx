import type { RoomStatus } from '../../shared/types';
import { Logo, ThemeToggle } from './ui';
import { IconCopy, IconGear, IconUsers, IconX } from './icons';

export function RoomChrome({
  code,
  status,
  count,
  max,
  isHost,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
  onInvite,
  onCopyCode,
  onLeave,
  onCloseRoom,
  onReturnLobby,
  solo,
  hudSlotRef
}: {
  code: string;
  status: RoomStatus;
  count: number;
  max: number;
  isHost: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onInvite: () => void;
  onCopyCode: () => void;
  onLeave: () => void;
  onCloseRoom: () => void;
  onReturnLobby: () => void;
  solo?: boolean;
  hudSlotRef?: (el: HTMLDivElement | null) => void;
}) {
  return (
    <header className="room-bar">
      <Logo small />

      <button className="room-code" onClick={onCopyCode} aria-label={`Copy room code ${code}`}>
        <span>ROOM</span>
        <strong>{code}</strong>
        <IconCopy size={14} />
      </button>

      <div className="room-bar-middle">
        <div className="room-bar-hud" ref={hudSlotRef} />
        {!solo && (
          <span className="room-player-count">
            <IconUsers size={14} /> {count}/{max}
          </span>
        )}
      </div>

      <div className="room-bar-actions">
        <ThemeToggle />
        <button
          className={`icon-button ${menuOpen ? 'icon-button-on' : ''}`}
          onClick={onToggleMenu}
          aria-label="Room menu"
          aria-expanded={menuOpen}
        >
          {menuOpen ? <IconX size={19} /> : <IconGear size={19} />}
        </button>
      </div>

      {menuOpen && (
        <>
          <div className="menu-backdrop" onClick={onCloseMenu} />
          <div className="room-menu" role="menu">
            {isHost && status !== 'lobby' && (
              <button type="button" role="menuitem" onClick={onReturnLobby}>
                {status === 'countdown' ? 'Cancel the countdown' : 'Back to the lobby'}
              </button>
            )}
            <div className="menu-separator" />
            <button type="button" role="menuitem" onClick={onLeave}>
              Leave room
            </button>
            {isHost && !solo && (
              <button type="button" role="menuitem" className="menu-danger" onClick={onCloseRoom}>
                Close room for everyone
              </button>
            )}
          </div>
        </>
      )}
    </header>
  );
}
