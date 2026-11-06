import { useEffect, useRef, useState } from 'react';
import {
  GAME_META,
  type PublicRoom,
  type RoomSettings,
  type SolitaireSlot,
  type You
} from '../../shared/types';
import { ApiError, createRoom, fetchRoom, type Preview } from '../lib/api';
import { copyText } from '../lib/copy';
import { statusLabel } from '../lib/format';
import { navigate, Link } from '../lib/router';
import {
  clearToken,
  loadProfile,
  removeRecent,
  saveProfile,
  saveToken,
  touchRecent,
  type Profile
} from '../lib/storage';
import { useRoomSocket } from '../lib/useRoomSocket';
import { Countdown } from '../components/Countdown';
import { Game } from '../components/Game';
import { InvitePanel } from '../components/InvitePanel';
import { Lobby } from '../components/Lobby';
import { MahjongGame } from '../components/MahjongGame';
import { ProfileModal } from '../components/ProfileModal';
import { Results } from '../components/Results';
import { SolitaireGame } from '../components/SolitaireGame';
import { SudokuGame } from '../components/SudokuGame';
import { RoomChrome } from '../components/RoomChrome';
import { SettingsSheet } from '../components/SettingsSheet';
import { StateScreen } from '../components/StateScreen';
import { IconArrow, IconEye, IconMine, IconRefresh, IconUsers } from '../components/icons';
import { Modal, Spinner, Toast } from '../components/ui';

function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

function JoiningRoom({
  code,
  onCancel,
  onReload
}: {
  code: string;
  onCancel: () => void;
  onReload: () => void;
}) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 7000);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <StateScreen
      logo
      spinner
      title={`Joining ${code}…`}
      body={slow ? 'This is taking longer than usual.' : 'Pulling up a chair.'}
      actions={
        slow ? (
          <>
            <button className="button button-secondary" onClick={onCancel}>
              Back home
            </button>
            <button className="button button-ghost" onClick={onReload}>
              <IconRefresh size={16} /> Reload
            </button>
          </>
        ) : undefined
      }
    />
  );
}

function FatalRoom({
  code,
  fatal,
  busy,
  error,
  onCreate
}: {
  code: string;
  fatal: { code: string; message: string };
  busy: boolean;
  error: string | null;
  onCreate: () => void;
}) {
  const heading =
    fatal.code === 'not_found'
      ? 'That room is gone.'
      : fatal.code === 'replaced'
        ? "You're in another tab."
        : fatal.code === 'kicked'
          ? 'You were removed.'
          : fatal.code === 'closed'
            ? 'The room closed.'
            : 'Something broke.';
  return (
    <StateScreen
      eyebrow={`Room ${code}`}
      title={heading}
      body={fatal.message}
      error={error}
      actions={
        <>
          <button className="button button-primary button-xl" onClick={onCreate} disabled={busy}>
            {busy ? <Spinner label="Creating" /> : <IconMine size={18} />} Start a new room
          </button>
          <Link className="button button-secondary button-xl" to="/join">
            Join with a code
          </Link>
        </>
      }
      home
    />
  );
}

function ConnectionBanner({ connection }: { connection: string }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    setSlow(false);
    if (connection === 'open') return;
    const timer = window.setTimeout(() => setSlow(true), 8000);
    return () => window.clearTimeout(timer);
  }, [connection]);

  if (connection === 'open') return null;
  return (
    <div className="connection-banner" role="status">
      <Spinner label="Reconnecting" />
      <span>{connection === 'reconnecting' ? 'Reconnecting…' : 'Connecting…'}</span>
      {slow && (
        <button className="text-button" onClick={() => window.location.reload()}>
          Reload
        </button>
      )}
    </div>
  );
}

export function RoomPage({ code }: { code: string }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewState, setPreviewState] = useState<'loading' | 'ready' | 'missing' | 'error'>(
    'loading'
  );
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [profile, setProfile] = useState<Profile>(() => loadProfile());
  const [joining, setJoining] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [localToast, setLocalToast] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const autoJoined = useRef(false);
  const spectateFallback = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recentTracked = useRef(false);

  const online = useOnline();
  const { state, connect, send, disconnect } = useRoomSocket(code);
  const room = state.room;
  const you = state.you;
  const isHost = Boolean(room && you && room.hostId === you.id);

  const notify = (message: string) => {
    setLocalToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setLocalToast(null), 3200);
  };

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setPreviewState('loading');
    setPreviewMessage(null);
    fetchRoom(code)
      .then((data) => {
        if (cancelled) return;
        setPreview(data);
        setPreviewState('ready');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.code === 'not_found') {
          clearToken(code);
          removeRecent(code);
          setPreview(null);
          setPreviewState('missing');
          return;
        }
        setPreview(null);
        setPreviewState('error');
        setPreviewMessage(error instanceof Error ? error.message : 'Could not reach the room.');
      });
    return () => {
      cancelled = true;
    };
  }, [code, reloadKey]);

  useEffect(() => {
    if (previewState !== 'ready' || autoJoined.current) return;
    if (state.joined || state.fatal) return;
    autoJoined.current = true;
    saveProfile(profile);
    setJoining(true);
    connect({ name: profile.name, avatar: profile.avatar });
  }, [previewState, state.joined, state.fatal, connect, profile]);

  useEffect(() => {
    if (state.joined || state.fatal || state.joinError?.code !== 'full') return;
    if (spectateFallback.current) return;
    spectateFallback.current = true;
    setJoining(true);
    notify('This room is full — you are watching until a seat opens.');
    connect({ name: profile.name, avatar: profile.avatar, spectate: true });
  }, [state.joined, state.fatal, state.joinError, connect, profile, notify]);

  useEffect(() => {
    if (state.joined || state.fatal) {
      setJoining(false);
      return;
    }
    if (state.joinError && state.joinError.code !== 'full') setJoining(false);
  }, [state.joined, state.joinError, state.fatal]);

  useEffect(() => {
    if (!state.fatal) return;
    if (state.fatal.code === 'not_found' || state.fatal.code === 'closed') {
      clearToken(code);
      removeRecent(code);
    }
  }, [state.fatal, code]);

  useEffect(() => {
    if (!state.joined || !room || !you) return;
    if (!recentTracked.current) {
      recentTracked.current = true;
      const host = room.players.find((player) => player.isHost);
      touchRecent(code, host ? `${host.name}'s room` : `${GAME_META[room.settings.game].label} room`);
    }
    if (you.role === 'player') {
      const next = { name: you.name, avatar: you.avatar };
      if (next.name !== profile.name || next.avatar !== profile.avatar) {
        setProfile(next);
        saveProfile(next);
      }
    }
  }, [state.joined, room, you, code, profile.name, profile.avatar]);

  useEffect(() => {
    if (room) {
      const gameName = GAME_META[room.settings.game].label;
      document.title = `${room.code} · ${statusLabel(room.status)} · ${gameName}`;
    } else {
      document.title = `${code} · Games, together`;
    }
  }, [room, code]);

  useEffect(() => {
    if (room?.status !== 'results') {
      setShowResults(false);
      return;
    }
    if (showResults) return;
    const timer = window.setTimeout(() => setShowResults(true), 1250);
    return () => window.clearTimeout(timer);
  }, [room?.status, room?.lastResult?.endedAt, showResults]);

  useEffect(() => {
    if (state.joinError && state.room) notify(state.joinError.message);
  }, [state.joinError]);

  useEffect(() => {
    if (room && room.status !== 'lobby' && room.status !== 'results') {
      setProfileOpen(false);
      setSettingsOpen(false);
    }
    setEndOpen(false);
  }, [room?.status]);

  const createNew = async () => {
    if (actionBusy) return;
    setActionBusy(true);
    setActionError(null);
    try {
      const result = await createRoom();
      saveToken(result.code, result.token);
      saveProfile(profile);
      touchRecent(result.code, 'Your room');
      navigate(`/r/${result.code}`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not create a room.');
      setActionBusy(false);
    }
  };

  const join = (nextProfile: Profile) => {
    setProfile(nextProfile);
    saveProfile(nextProfile);
    setJoining(true);
    connect({ name: nextProfile.name, avatar: nextProfile.avatar });
  };

  const leave = () => {
    send({ t: 'leave' });
    window.setTimeout(() => {
      disconnect();
      navigate('/');
    }, 90);
  };

  const saveProfileAndSend = (next: Profile) => {
    setProfile(next);
    saveProfile(next);
    send({ t: 'profile', name: next.name, avatar: next.avatar });
  };

  const applySettings = (next: RoomSettings) => {
    send({
      t: 'settings',
      game: next.game,
      preset: next.preset,
      lives: next.lives,
      maxPlayers: next.maxPlayers,
      lateJoin: next.lateJoin,
      sudokuDifficulty: next.sudokuDifficulty,
      klondikeDraw: next.klondikeDraw,
      mahjongLayout: next.mahjongLayout
    });
  };

  const copyCode = async () => {
    const ok = await copyText(code);
    notify(ok ? `Code ${code} copied.` : `Copy failed — the code is ${code}.`);
  };

  const closeRoom = () => {
    send({ t: 'close' });
    setCloseOpen(false);
    window.setTimeout(() => {
      disconnect();
      navigate('/');
    }, 260);
  };

  const askEndGame = () => setEndOpen(true);

  const endGame = () => {
    setEndOpen(false);
    send({ t: 'lobby' });
  };

  if (state.fatal) {
    return (
      <FatalRoom
        code={code}
        fatal={state.fatal}
        busy={actionBusy}
        error={actionError}
        onCreate={() => void createNew()}
      />
    );
  }

  if (room && you) {
    const spectator = you.role === 'spectator';
    const wideBoard =
      room.status !== 'lobby' &&
      room.settings.game === 'minesweeper' &&
      room.settings.width > room.settings.height * 1.5;
    const canTakeSeat =
      spectator &&
      room.players.length < room.settings.maxPlayers &&
      (room.status !== 'playing' || room.settings.lateJoin);
    const full = room.players.length >= room.settings.maxPlayers;
    const content =
      room.status === 'lobby' ? (
        <Lobby
          room={room}
          you={you}
          connected={state.connection === 'open'}
          onStart={() => send({ t: 'start' })}
          onSettings={() => setSettingsOpen(true)}
          onProfile={() => setProfileOpen(true)}
          onSettingsChange={applySettings}
        />
      ) : room.status === 'countdown' ? (
        <Countdown
          room={room}
          you={you}
          serverOffset={state.serverOffset}
          onCancel={() => send({ t: 'lobby' })}
        />
      ) : room.status === 'results' && showResults ? (
        <Results
          room={room}
          you={you}
          connected={state.connection === 'open'}
          serverOffset={state.serverOffset}
          onLobby={() => send({ t: 'lobby' })}
          onInvite={() => setInviteOpen(true)}
          onLeave={leave}
        />
      ) : room.settings.game === 'sudoku' && room.sudoku ? (
        <SudokuGame
          room={room}
          you={you}
          connected={state.connection === 'open'}
          serverOffset={state.serverOffset}
          sudokuRecent={state.sudokuRecent}
          onEntry={(i, digit) => send({ t: 'sudoku', i, digit })}
          onEndGame={askEndGame}
        />
      ) : room.solitaire ? (
        <SolitaireGame
          room={room}
          you={you}
          connected={state.connection === 'open'}
          serverOffset={state.serverOffset}
          onDraw={() => send({ t: 'solitaire', action: 'draw' })}
          onRecycle={() => send({ t: 'solitaire', action: 'recycle' })}
          onMove={(card: number, to: SolitaireSlot) =>
            send({ t: 'solitaire', action: 'move', card, to })
          }
          onAuto={(card: number) => send({ t: 'solitaire', action: 'auto', card })}
          onCursor={(x, y) => send({ t: 'cursor', x, y })}
          onEndGame={askEndGame}
        />
      ) : room.mahjong ? (
        <MahjongGame
          room={room}
          you={you}
          connected={state.connection === 'open'}
          serverOffset={state.serverOffset}
          onMatch={(a, b) => send({ t: 'mahjong', action: 'match', a, b })}
          onShuffle={() => send({ t: 'mahjong', action: 'shuffle' })}
          onSelect={(i) => send({ t: 'mahjong', action: 'select', i })}
          onCursor={(x, y) => send({ t: 'cursor', x, y })}
          onEndGame={askEndGame}
        />
      ) : (
        <Game
          room={room}
          you={you}
          connected={state.connection === 'open'}
          serverOffset={state.serverOffset}
          recent={state.recent}
          stale={state.stale}
          onReveal={(i) => send({ t: 'reveal', i })}
          onFlag={(i) => send({ t: 'flag', i })}
          onChord={(i) => send({ t: 'chord', i })}
          onCursor={(x, y) => send({ t: 'cursor', x, y })}
          onEndGame={askEndGame}
        />
      );

    return (
      <div className="room-page">
        <RoomChrome
          code={room.code}
          status={room.status}
          count={room.players.length}
          max={room.settings.maxPlayers}
          isHost={isHost}
          menuOpen={menuOpen}
          onToggleMenu={() => setMenuOpen((value) => !value)}
          onCloseMenu={() => setMenuOpen(false)}
          onInvite={() => {
            setMenuOpen(false);
            setInviteOpen(true);
          }}
          onCopyCode={() => void copyCode()}
          onLeave={leave}
          onCloseRoom={() => {
            setMenuOpen(false);
            setCloseOpen(true);
          }}
          onReturnLobby={() => {
            setMenuOpen(false);
            send({ t: 'lobby' });
          }}
        />

        {!online && (
          <div className="offline-banner" role="alert">
            You're offline. The board is safe — we'll reconnect you.
          </div>
        )}
        {online && state.connection !== 'open' && (
          <ConnectionBanner connection={state.connection} />
        )}

        {spectator && (
          <div className="spectator-bar">
            <span className="spectator-copy">
              <IconEye size={16} /> Watching
              {full
                ? ` · ${room.players.length}/${room.settings.maxPlayers} seats full`
                : ` · ${room.players.length}/${room.settings.maxPlayers} seats taken`}
            </span>
            {canTakeSeat ? (
              <button className="button button-primary button-sm" onClick={() => join(profile)}>
                <IconUsers size={15} /> Take a seat
              </button>
            ) : (
              <span className="spectator-note">
                {full ? 'A seat opens when someone leaves.' : "You'll get a seat when the round ends."}
              </span>
            )}
          </div>
        )}

        <main className={`room-main ${wideBoard ? 'room-main-wide' : ''}`}>{content}</main>

        <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite players" wide>
          <InvitePanel room={room} />
        </Modal>

        <SettingsSheet
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          settings={room.settings}
          playerCount={room.players.length}
          onApply={applySettings}
        />

        <ProfileModal
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          profile={profile}
          onSave={saveProfileAndSend}
        />

        <Modal open={closeOpen} onClose={() => setCloseOpen(false)} title="Close this room?">
          <div className="confirm-body">
            <p>
              This ends the room for everyone. There is no score to save, but the code stops
              working immediately.
            </p>
            <div className="settings-actions">
              <button className="button button-ghost" onClick={() => setCloseOpen(false)}>
                Keep playing
              </button>
              <button className="button button-danger" onClick={closeRoom}>
                Close room
              </button>
            </div>
          </div>
        </Modal>

        <Modal open={endOpen} onClose={() => setEndOpen(false)} title="End this game?">
          <div className="confirm-body">
            <p>
              Everyone goes back to the lobby and this board is discarded — the round doesn't
              count for anything.
            </p>
            <div className="settings-actions">
              <button className="button button-ghost" onClick={() => setEndOpen(false)}>
                Keep playing
              </button>
              <button className="button button-danger" onClick={endGame}>
                End game
              </button>
            </div>
          </div>
        </Modal>

        <Toast message={localToast ?? state.toast?.message ?? null} />
      </div>
    );
  }

  if (previewState === 'loading') {
    return (
      <StateScreen
        logo
        spinner
        title={`Finding room ${code}…`}
        body="Checking who is already at the table."
      />
    );
  }
  if (previewState === 'missing') {
    return (
      <StateScreen
        eyebrow="Room not found"
        title={`No room with code ${code}.`}
        body="The code may have a typo, or the room closed after everyone left. Rooms stick around for a day after the last player."
        error={actionError}
        actions={
          <>
            <Link className="button button-primary button-xl" to="/join">
              Try another code <IconArrow size={18} />
            </Link>
            <button
              className="button button-secondary button-xl"
              onClick={() => void createNew()}
              disabled={actionBusy}
            >
              {actionBusy ? <Spinner label="Creating" /> : <IconMine size={18} />} Create a new
              room
            </button>
          </>
        }
        home
      />
    );
  }
  if (previewState === 'error') {
    return (
      <StateScreen
        eyebrow="No signal"
        title="Can't reach that room."
        body={previewMessage ?? 'The room did not answer.'}
        hint="If the host is running the game on a laptop, everyone needs to be on the same Wi-Fi."
        error={actionError}
        actions={
          <>
            <button
              className="button button-primary button-xl"
              onClick={() => setReloadKey((value) => value + 1)}
            >
              <IconRefresh size={18} /> Try again
            </button>
            <button
              className="button button-secondary button-xl"
              onClick={() => void createNew()}
              disabled={actionBusy}
            >
              Create a new room
            </button>
          </>
        }
        home
      />
    );
  }
  if (joining) {
    return (
      <JoiningRoom
        code={code}
        onCancel={() => {
          disconnect();
          navigate('/');
        }}
        onReload={() => window.location.reload()}
      />
    );
  }

  if (state.joinError && state.joinError.code !== 'full') {
    return (
      <StateScreen
        eyebrow={`Room ${code}`}
        title="Couldn't take a seat."
        body={state.joinError.message}
        actions={
          <>
            <button
              className="button button-primary button-xl"
              onClick={() => {
                setJoining(true);
                connect({ name: profile.name, avatar: profile.avatar });
              }}
              disabled={actionBusy}
            >
              <IconRefresh size={18} /> Try again
            </button>
            <button
              className="button button-secondary button-xl"
              onClick={() => void createNew()}
              disabled={actionBusy}
            >
              Start a new room
            </button>
          </>
        }
        home
      />
    );
  }

  if (preview) {
    return (
      <JoiningRoom
        code={code}
        onCancel={() => {
          disconnect();
          navigate('/');
        }}
        onReload={() => window.location.reload()}
      />
    );
  }

  return (
    <StateScreen
      logo
      spinner
      title={`Finding room ${code}…`}
      body="Checking who is already at the table."
    />
  );
}
