import {
  GAME_META,
  GAME_ORDER,
  KLONDIKE_DRAW_OPTIONS,
  PRESETS,
  PRESET_IDS,
  SUDOKU_DIFFICULTIES,
  SUDOKU_DIFFICULTY_IDS,
  isSolitaireVariant,
  type GameKind,
  type GameResult,
  type KlondikeDraw,
  type PresetId,
  type PublicRoom,
  type RoomSettings,
  type SudokuDifficulty,
  type You
} from '../../shared/types';
import { formatClock, plural } from '../lib/format';
import { InvitePanel } from './InvitePanel';
import { Avatar } from './ui';
import { GameIcon } from './GameIcon';
import {
  IconCrown,
  IconGear,
  IconMine,
  IconPlus,
  IconSudoku,
  IconUsers
} from './icons';

function lastResultLabel(result: GameResult): string {
  if (result.game === 'sudoku') {
    return `Sudoku ${SUDOKU_DIFFICULTIES[result.difficulty].label} · solved ${formatClock(result.durationMs / 1000)}`;
  }
  if (result.game === 'klondike' || result.game === 'freecell') {
    return `${GAME_META[result.game].label} · solved ${formatClock(result.durationMs / 1000)}`;
  }
  return `Minesweeper · ${result.result === 'won' ? 'cleared' : 'out of lives'} ${formatClock(result.durationMs / 1000)}`;
}

export function Lobby({
  room,
  you,
  connected,
  onStart,
  onSettings,
  onProfile,
  onSettingsChange
}: {
  room: PublicRoom;
  you: You;
  connected: boolean;
  onStart: () => void;
  onSettings: () => void;
  onProfile: () => void;
  onSettingsChange: (settings: RoomSettings) => void;
}) {
  const isHost = room.hostId === you.id;
  const host = room.players.find((player) => player.isHost);
  const roomName = host ? `${host.name}'s room` : `Room ${room.code}`;
  const openSeats = Math.max(0, room.settings.maxPlayers - room.players.length);
  const offline = room.players.filter((player) => !player.connected).length;
  const emptyShown = Math.min(openSeats, 2);
  const game = room.settings.game;
  const sudoku = game === 'sudoku';
  const solitaire = isSolitaireVariant(game);
  const gameMeta = GAME_META[game];
  const presetLabel =
    room.settings.preset === 'cozy' ? 'Cozy' : room.settings.preset === 'big' ? 'Big' : 'Classic';
  const difficulty = SUDOKU_DIFFICULTIES[room.settings.sudokuDifficulty];
  const duo = room.settings.maxPlayers === 2;
  const connectedCount = room.players.filter((player) => player.connected).length;
  const friendMissing = duo && room.players.length < 2;
  const friendOffline = duo && room.players.length >= 2 && connectedCount < 2;
  const duoWaiting = duo && (friendMissing || friendOffline);
  const startDisabled = !connected || room.players.length === 0 || (duo && connectedCount < 2);
  const hostHeading = duo
    ? friendMissing
      ? 'Waiting for your friend.'
      : friendOffline
        ? 'Your friend dropped.'
        : 'Both seats are in.'
    : solitaire
      ? room.players.length > 1
        ? 'One table, no turns.'
        : 'A solo deal?'
      : room.players.length > 1
        ? sudoku
          ? 'Solve it together.'
          : 'Start when everyone is here.'
        : sudoku
          ? 'Start a solo sudoku?'
          : 'Start a solo board?';
  const hostCopy = duo
    ? friendMissing
      ? 'Share the code or the QR. This room starts when the second seat fills.'
      : friendOffline
        ? 'Their seat is still held. Start once they are back.'
        : solitaire
          ? `A ${gameMeta.label} table, two players. Anyone can move the cards.`
          : sudoku
            ? `A ${difficulty.label} Sudoku, two players. Start when you are ready.`
            : `A ${presetLabel} board, two players. Start when you are ready.`
    : solitaire
      ? `One shared ${gameMeta.label} table. Everyone at the table can move the cards — no turns.`
      : sudoku
        ? 'Everyone fills one shared 9×9 grid. Wrong digits turn red, and anyone can replace them.'
        : room.players.length > 1
          ? 'The countdown gives everyone a second to look up.'
          : 'You can start alone and friends can jump in later.';
  const startLabel = duo && duoWaiting
    ? 'Waiting for friend'
    : solitaire
      ? `Start ${gameMeta.label}`
      : sudoku
        ? 'Start Sudoku'
        : room.players.length > 1
          ? 'Start Minesweeper'
          : 'Start solo';

  const changeGame = (next: GameKind) => {
    if (!isHost || next === game) return;
    onSettingsChange({ ...room.settings, game: next });
  };

  const changePreset = (preset: PresetId) => {
    const chosen = PRESETS[preset];
    onSettingsChange({
      ...room.settings,
      preset,
      width: chosen.width,
      height: chosen.height,
      mines: chosen.mines
    });
  };

  const changeDifficulty = (next: SudokuDifficulty) => {
    onSettingsChange({ ...room.settings, sudokuDifficulty: next });
  };

  const changeKlondikeDraw = (next: KlondikeDraw) => {
    onSettingsChange({ ...room.settings, klondikeDraw: next });
  };

  const changeSeats = (maxPlayers: number) => {
    onSettingsChange({ ...room.settings, maxPlayers });
  };

  const fewestSeats = Math.max(2, room.players.length);

  return (
    <div className="lobby">
      <div className="lobby-intro">
        <div>
          <span className="eyebrow">
            <span className="eyebrow-dot" /> Lobby
          </span>
          <h1>{roomName}</h1>
          {duo && (
            <span className="duo-badge">
              <IconUsers size={12} /> Two-seat room
            </span>
          )}
          <p>
            {duo
              ? friendMissing
                ? 'Just you so far. One friend gets the other seat.'
                : friendOffline
                  ? 'Both seats are taken. Your friend is reconnecting.'
                  : 'Both seats are in. Pick a game and go.'
              : room.players.length === 0
                ? 'The room is open. The first person in gets a chair.'
                : `${room.players.length} ${plural(room.players.length, 'player')} here, ${openSeats} ${plural(openSeats, 'seat')} open.`}
            {!duo && offline > 0 && ` ${offline} offline.`}
          </p>

          {you.role === 'player' && (
            <div className="lobby-identity">
              <Avatar avatar={you.avatar} color={you.color} size={28} />
              <span>
                You&apos;re <strong>{you.name}</strong>
              </span>
              <button type="button" className="text-button" onClick={onProfile}>
                Change name &amp; icon
              </button>
            </div>
          )}

          <div className="game-switcher">
            <span className="game-switcher-label">Choose a game</span>
            <div className="game-switcher-options" role="group" aria-label="Choose a game">
              {GAME_ORDER.map((id) => {
                const meta = GAME_META[id];
                return (
                  <button
                    key={id}
                    type="button"
                    className={`game-option ${game === id ? 'game-option-on' : ''}`}
                    onClick={() => changeGame(id)}
                    disabled={!isHost}
                    aria-pressed={game === id}
                  >
                    <GameIcon game={id} size={17} />
                    <span>{meta.label}</span>
                    <em>{meta.kicker}</em>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="lobby-code-block">
          <span>Room code</span>
          <strong>{room.code}</strong>
        </div>
      </div>

      {room.lastResult && (
        <div className="last-game">
          <span className="last-game-label">Last game</span>
          <strong>{lastResultLabel(room.lastResult)}</strong>
          <span className="last-game-hint">Pick the next one.</span>
        </div>
      )}

      <div className="lobby-columns">
        <div className="lobby-main">
        <section className="panel players-panel">
          <div className="panel-head">
            <h2>
              <IconUsers size={18} /> At the table
            </h2>
            <span className="panel-count">
              {room.players.length}/{room.settings.maxPlayers}
            </span>
          </div>

          <div className="player-grid">
            {room.players.map((player) => {
              const self = player.id === you.id;
              const content = (
                <>
                  <Avatar
                    avatar={player.avatar}
                    color={player.color}
                    size={44}
                    connected={player.connected}
                  />
                  <span className="player-chip-copy">
                    <span className="player-chip-name">
                      {player.name}
                      {self && <em>you</em>}
                    </span>
                    <span className="player-chip-meta">
                      {player.connected ? 'here' : 'reconnecting…'}
                    </span>
                  </span>
                  {player.isHost && (
                    <span className="player-chip-host" title="Host">
                      <IconCrown size={14} />
                    </span>
                  )}
                  {self && <span className="player-chip-edit">edit</span>}
                </>
              );
              return self ? (
                <button
                  type="button"
                  className="player-chip player-chip-self"
                  key={player.id}
                  onClick={onProfile}
                  aria-label="Edit your name and avatar"
                >
                  {content}
                </button>
              ) : (
                <div className="player-chip" key={player.id}>
                  {content}
                </div>
              );
            })}

            {Array.from({ length: emptyShown }, (_, index) => (
              <div className="player-chip player-chip-empty" key={`empty-${index}`}>
                <span className="empty-plus">
                  <IconPlus size={18} />
                </span>
                <span className="player-chip-copy">
                  <span className="player-chip-name">Open seat</span>
                  <span className="player-chip-meta">send the code</span>
                </span>
              </div>
            ))}
            {openSeats > emptyShown && (
              <div className="player-chip player-chip-empty player-chip-more">
                <span className="empty-plus">+{openSeats - emptyShown}</span>
                <span className="player-chip-copy">
                  <span className="player-chip-name">{openSeats - emptyShown} more open</span>
                  <span className="player-chip-meta">send the code</span>
                </span>
              </div>
            )}
          </div>
        </section>

        <InvitePanel room={room} />
        </div>

        <aside className="lobby-side">
          <section className="panel start-panel">
            {isHost ? (
              <>
                <span className="eyebrow">You're the host</span>
                <h2>{hostHeading}</h2>
                <p>{hostCopy}</p>

                <div className="quick-settings">
                  {sudoku ? (
                    <div className="quick-setting">
                      <span className="quick-setting-label">Difficulty</span>
                      <div className="quick-sizes quick-difficulties" role="group" aria-label="Sudoku difficulty">
                        {SUDOKU_DIFFICULTY_IDS.map((id) => {
                          const option = SUDOKU_DIFFICULTIES[id];
                          return (
                            <button
                              key={id}
                              type="button"
                              className={`quick-size ${room.settings.sudokuDifficulty === id ? 'quick-size-on' : ''}`}
                              onClick={() => changeDifficulty(id)}
                              aria-pressed={room.settings.sudokuDifficulty === id}
                              disabled={!connected}
                            >
                              <strong>{option.label}</strong>
                              <span>{option.clues} clues</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : solitaire ? (
                    game === 'klondike' ? (
                      <div className="quick-setting">
                        <span className="quick-setting-label">Draw</span>
                        <div className="quick-sizes quick-draws" role="group" aria-label="Klondike draw">
                          {KLONDIKE_DRAW_OPTIONS.map((value) => (
                            <button
                              key={value}
                              type="button"
                              className={`quick-size ${room.settings.klondikeDraw === value ? 'quick-size-on' : ''}`}
                              onClick={() => changeKlondikeDraw(value)}
                              aria-pressed={room.settings.klondikeDraw === value}
                              disabled={!connected}
                            >
                              <strong>{value} card{value === 1 ? '' : 's'}</strong>
                              <span>{value === 1 ? 'Gentle' : 'Classic'}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null
                  ) : (
                    <div className="quick-setting">
                      <span className="quick-setting-label">Game size</span>
                      <div className="quick-sizes" role="group" aria-label="Game size">
                        {PRESET_IDS.map((id) => {
                          const preset = PRESETS[id];
                          return (
                            <button
                              key={id}
                              type="button"
                              className={`quick-size ${room.settings.preset === id ? 'quick-size-on' : ''}`}
                              onClick={() => changePreset(id)}
                              aria-pressed={room.settings.preset === id}
                              disabled={!connected}
                            >
                              <strong>{preset.label}</strong>
                              <span>
                                {preset.width}×{preset.height}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div className="quick-setting quick-setting-row">
                    <span className="quick-setting-label">Players</span>
                    <div className="seat-stepper" role="group" aria-label="Seat count">
                      <button
                        type="button"
                        onClick={() => changeSeats(room.settings.maxPlayers - 1)}
                        disabled={!connected || room.settings.maxPlayers <= fewestSeats}
                        aria-label="Smaller game: fewer seats"
                      >
                        −
                      </button>
                      <span>{room.settings.maxPlayers} seats</span>
                      <button
                        type="button"
                        onClick={() => changeSeats(room.settings.maxPlayers + 1)}
                        disabled={!connected || room.settings.maxPlayers >= 8}
                        aria-label="Larger game: more seats"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <p className="quick-setting-note">Settings change before the countdown.</p>
                </div>

                <button
                  className="button button-primary button-xl start-button"
                  onClick={onStart}
                  disabled={startDisabled}
                >
                  {startLabel}
                </button>
                <span className="start-note">
                  {duo ? 'A two-seat room starts with both players here.' : 'No ready checks. You call it.'}
                </span>
              </>
            ) : (
              <>
                <span className="eyebrow">Waiting</span>
                <h2>{host ? `Waiting for ${host.name}.` : 'Waiting for the host.'}</h2>
                <p>
                  {host
                    ? `${host.name} has the start button. You'll hear the countdown.`
                    : 'The room exists, but the host has not landed yet.'}
                </p>
                <div className="waiting-bar" aria-hidden="true">
                  <span />
                </div>
                <span className="start-note">The link stays the same after every game.</span>
              </>
            )}
          </section>

          <section className="panel board-summary">
            <div className="panel-head">
              <h2>
                <GameIcon game={game} size={17} />
                {solitaire ? 'The table' : sudoku ? 'The grid' : 'The board'}
              </h2>
              {isHost && (
                <button className="text-button" onClick={onSettings}>
                  <IconGear size={14} /> Change
                </button>
              )}
            </div>
            {sudoku ? (
              <>
                <div className="board-facts">
                  <div>
                    <span>Difficulty</span>
                    <strong>{difficulty.label}</strong>
                  </div>
                  <div>
                    <span>Grid</span>
                    <strong>9×9</strong>
                  </div>
                  <div>
                    <span>Clues</span>
                    <strong>{difficulty.clues}</strong>
                  </div>
                  <div>
                    <span>Lives</span>
                    <strong>None</strong>
                  </div>
                </div>
                <p className="board-summary-note">
                  Everyone fills the same grid. Wrong digits turn red and anyone can replace
                  them. {room.settings.lateJoin ? 'Friends can jump in after it starts.' : 'The door closes when it starts.'}
                </p>
              </>
            ) : solitaire ? (
              <>
                <div className="board-facts">
                  {game === 'klondike' ? (
                    <>
                      <div>
                        <span>Draw</span>
                        <strong>{room.settings.klondikeDraw} at a time</strong>
                      </div>
                      <div>
                        <span>Tableau</span>
                        <strong>7 columns</strong>
                      </div>
                      <div>
                        <span>Redeals</span>
                        <strong>Unlimited</strong>
                      </div>
                      <div>
                        <span>Players</span>
                        <strong>Anyone moves</strong>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <span>Deal</span>
                        <strong>All face up</strong>
                      </div>
                      <div>
                        <span>Tableau</span>
                        <strong>8 columns</strong>
                      </div>
                      <div>
                        <span>Free cells</span>
                        <strong>4</strong>
                      </div>
                      <div>
                        <span>Players</span>
                        <strong>Anyone moves</strong>
                      </div>
                    </>
                  )}
                </div>
                <p className="board-summary-note">
                  One shared table, no turns. Tap a card and then where it goes.{' '}
                  {room.settings.lateJoin
                    ? 'Friends can jump in after the deal.'
                    : 'The door closes when the deal starts.'}
                </p>
              </>
            ) : (
              <>
                <div className="board-facts">
                  <div>
                    <span>Preset</span>
                    <strong>{presetLabel}</strong>
                  </div>
                  <div>
                    <span>Grid</span>
                    <strong>
                      {room.settings.width}×{room.settings.height}
                    </strong>
                  </div>
                  <div>
                    <span>Mines</span>
                    <strong>{room.settings.mines}</strong>
                  </div>
                  <div>
                    <span>Lives</span>
                    <strong>{room.settings.lives} shared</strong>
                  </div>
                </div>
                <p className="board-summary-note">
                  {room.settings.lateJoin
                    ? 'Friends can jump in after the game starts.'
                    : 'The door closes when the game starts.'}{' '}
                  First click is always safe.
                </p>
              </>
            )}
          </section>
        </aside>
      </div>

      <div className="lobby-tips">
        <span>
          <strong>One room.</strong> Four games, same table.
        </span>
        <span>
          <strong>Same link.</strong> Everyone lands back here after each game.
        </span>
        <span>
          <strong>No chat.</strong> You're in the same room — talk.
        </span>
      </div>

      {isHost && (!duo || connectedCount === 2) && (
        <div className="mobile-start-bar">
          <div>
            <strong>
              {room.players.length} {plural(room.players.length, 'player')} here
            </strong>
            <span>
              {solitaire
                ? `${gameMeta.label} · ${game === 'klondike' ? `draw ${room.settings.klondikeDraw}` : 'free cells'}`
                : sudoku
                  ? `Sudoku · ${difficulty.label}`
                  : `${presetLabel} · ${room.settings.width}×${room.settings.height}`}
            </span>
          </div>
          <button
            className="button button-primary"
            onClick={onStart}
            disabled={startDisabled}
          >
            {startLabel}
          </button>
          <button
            className="icon-button mobile-size-button"
            onClick={onSettings}
            aria-label="Change game settings"
            title="Change game settings"
          >
            <IconGear size={17} />
          </button>
        </div>
      )}
    </div>
  );
}
