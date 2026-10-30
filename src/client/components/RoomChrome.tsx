import type { RoomStatus } from '../../shared/types';
import { Link } from '../lib/router';
import { Logo, StatusPill, ThemeToggle } from './ui';
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
  onReturnLobby
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
}) {
  const label =
    status === 'playing'
      ? 'Live'
      : status === 'countdown'
        ? 'Starting'
        : status === 'results'
          ? 'Results'
          : 'Lobby';

  return (
    <header className="room-bar">
      <Link to="/" className="room-home" aria-label="Leave and go home">
        <Logo small />
      </Link>

      <button className="room-code" onClick={onCopyCode} aria-label={`Copy room code ${code}`}>
        <span>ROOM</span>
        <strong>{code}</strong>
        <IconCopy size={14} />
      </button>

      <div className="room-bar-middle">
        <StatusPill tone={status === 'playing' ? 'live' : status === 'results' ? 'warm' : 'neutral'}>
          {status === 'playing' && <span className="live-dot" />}
          {label}
        </StatusPill>
        <span className="room-player-count">
          <IconUsers size={14} /> {count}/{max}
        </span>
      </div>

      <div className="room-bar-actions">
        <button className="button button-secondary button-sm invite-button" onClick={onInvite}>
          <IconUsers size={16} /> <span>Invite</span>
        </button>
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
            <button type="button" role="menuitem" onClick={onInvite}>
              Invite players
            </button>
            <button type="button" role="menuitem" onClick={onCopyCode}>
              Copy room code
            </button>
            {isHost && (status === 'playing' || status === 'results') && (
              <button type="button" role="menuitem" onClick={onReturnLobby}>
                Back to the lobby
              </button>
            )}
            <div className="menu-separator" />
            <button type="button" role="menuitem" onClick={onLeave}>
              Leave room
            </button>
            {isHost && (
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
