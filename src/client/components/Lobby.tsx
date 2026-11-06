import { useState } from 'react';
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
  type KlondikeDraw,
  type MahjongLayout,
  type PresetId,
  type PublicRoom,
  type RoomSettings,
  type SudokuDifficulty,
  type You
} from '../../shared/types';
import { MAHJONG_LAYOUTS, MAHJONG_LAYOUT_IDS, mahjongTileTotal } from '../../shared/mahjong';
import { InvitePanel } from './InvitePanel';
import { Avatar } from './ui';
import { GameIcon } from './GameIcon';
import { IconCrown, IconGear } from './icons';

type MobileTab = 'players' | 'invite' | 'game';

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
  const [mobileTab, setMobileTab] = useState<MobileTab>('players');

  const isHost = room.hostId === you.id;
  const host = room.players.find((player) => player.isHost);
  const roomName = host ? `${host.name}'s room` : `Room ${room.code}`;
  const openSeats = Math.max(0, room.settings.maxPlayers - room.players.length);
  const emptyShown = Math.min(openSeats, 2);
  const game = room.settings.game;
  const sudoku = game === 'sudoku';
  const solitaire = isSolitaireVariant(game);
  const mahjong = game === 'mahjong';
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
    : solitaire || mahjong
      ? room.players.length > 1
        ? 'One table, no turns.'
        : 'A solo deal?'
      : room.players.length > 1
        ? sudoku
          ? 'Solve it together.'
          : 'Start when everyone is here.'
        : sudoku
          ? 'Solo sudoku?'
          : 'Solo board?';
  const startLabel = duo && duoWaiting
    ? 'Waiting for friend'
    : solitaire || mahjong
      ? `Start ${gameMeta.label}`
      : sudoku
        ? 'Start Sudoku'
        : room.players.length > 1
          ? 'Start Minesweeper'
          : 'Start solo';

  const spec = sudoku
    ? 'One shared 9×9 grid'
    : game === 'klondike'
      ? '7 columns · unlimited redeals'
      : game === 'freecell'
        ? '8 columns · 4 free cells'
        : mahjong
          ? `${mahjongTileTotal(room.settings.mahjongLayout)} tiles · ${MAHJONG_LAYOUTS[room.settings.mahjongLayout].label.toLowerCase()} stack`
          : `${room.settings.mines} mines · ${room.settings.lives} shared ${room.settings.lives === 1 ? 'life' : 'lives'}`;

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

  const changeMahjongLayout = (next: MahjongLayout) => {
    onSettingsChange({ ...room.settings, mahjongLayout: next });
  };

  const changeSeats = (maxPlayers: number) => {
    onSettingsChange({ ...room.settings, maxPlayers });
  };

  const fewestSeats = Math.max(2, room.players.length);

  const switcher = (extraClass: string) => (
    <div
      className={`game-switcher ${extraClass}`}
      role="group"
      aria-label="Choose a game"
    >
      {GAME_ORDER.map((id) => (
        <button
          key={id}
          type="button"
          className={`game-option ${game === id ? 'game-option-on' : ''}`}
          onClick={() => changeGame(id)}
          disabled={!isHost}
          aria-pressed={game === id}
          title={isHost ? `Switch to ${GAME_META[id].label}` : 'Only the host can change the game'}
        >
          <GameIcon game={id} size={17} />
          <span>{GAME_META[id].label}</span>
        </button>
      ))}
    </div>
  );

  const tabs: Array<{ id: MobileTab; label: string }> = [
    { id: 'players', label: 'Players' },
    { id: 'invite', label: 'Invite' },
    { id: 'game', label: 'Game' }
  ];

  return (
    <div className="lobby" data-mobile-tab={mobileTab}>
      <div className="lobby-head">
        <h1>{roomName}</h1>

        {you.role === 'player' && (
          <button type="button" className="identity-chip" onClick={onProfile}>
            <Avatar avatar={you.avatar} color={you.color} size={28} />
            <strong>{you.name}</strong>
            <span className="identity-chip-change">Change</span>
          </button>
        )}
      </div>

      {switcher('lobby-switcher-top')}

      <div className="lobby-tabs" role="tablist" aria-label="Lobby sections">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={mobileTab === tab.id}
            className={mobileTab === tab.id ? 'lobby-tab-on' : ''}
            onClick={() => setMobileTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="lobby-columns">
        <div className="lobby-main">
          <section className="panel players-panel lobby-pane-players">
            <div className="panel-head">
              <h2>Players</h2>
            </div>

            <div className="player-grid">
              {room.players.map((player) => {
                const self = player.id === you.id;
                const content = (
                  <>
                    <Avatar
                      avatar={player.avatar}
                      color={player.color}
                      size={40}
                      connected={player.connected}
                    />
                    <span className="player-chip-copy">
                      <span className="player-chip-name">
                        {player.name}
                        {self && <em>you</em>}
                      </span>
                    </span>
                    {player.isHost && (
                      <span className="player-chip-host" title="Host">
                        <IconCrown size={14} />
                      </span>
                    )}
                  </>
                );
                return self ? (
                  <button
                    type="button"
                    className="player-chip player-chip-self"
                    key={player.id}
                    onClick={onProfile}
                    title="Edit your name and avatar"
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
                  <span className="player-chip-copy">
                    <span className="player-chip-name">Open seat</span>
                  </span>
                </div>
              ))}

            </div>
          </section>

          <div className="lobby-pane-invite">
            <InvitePanel room={room} />
          </div>
        </div>

        <aside className="lobby-side lobby-pane-game">
          {switcher('lobby-switcher-pane')}

          <section className="panel start-panel">
            {isHost ? (
              <>
                <h2>{hostHeading}</h2>

                <div className="quick-settings">
                  {sudoku ? (
                    <div className="quick-setting">
                      <span className="quick-setting-label">Difficulty</span>
                      <div className="quick-sizes" role="group" aria-label="Sudoku difficulty">
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
                  ) : game === 'klondike' ? (
                    <div className="quick-setting">
                      <span className="quick-setting-label">Draw</span>
                      <div className="quick-sizes" role="group" aria-label="Klondike draw">
                        {KLONDIKE_DRAW_OPTIONS.map((value) => (
                          <button
                            key={value}
                            type="button"
                            className={`quick-size ${room.settings.klondikeDraw === value ? 'quick-size-on' : ''}`}
                            onClick={() => changeKlondikeDraw(value)}
                            aria-pressed={room.settings.klondikeDraw === value}
                            disabled={!connected}
                          >
                            <strong>
                              {value} card{value === 1 ? '' : 's'}
                            </strong>
                            <span>{value === 1 ? 'Gentle' : 'Classic'}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : mahjong ? (
                    <div className="quick-setting">
                      <span className="quick-setting-label">Layout</span>
                      <div className="quick-sizes" role="group" aria-label="Mahjongg layout">
                        {MAHJONG_LAYOUT_IDS.map((id) => {
                          const option = MAHJONG_LAYOUTS[id];
                          return (
                            <button
                              key={id}
                              type="button"
                              className={`quick-size ${room.settings.mahjongLayout === id ? 'quick-size-on' : ''}`}
                              onClick={() => changeMahjongLayout(id)}
                              aria-pressed={room.settings.mahjongLayout === id}
                              disabled={!connected}
                            >
                              <strong>{option.label}</strong>
                              <span>{mahjongTileTotal(id)} tiles</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : !solitaire ? (
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
                  ) : null}

                  <div className="quick-setting quick-setting-row">
                    <span className="quick-setting-label">Seats</span>
                    <div className="seat-stepper" role="group" aria-label="Seat count">
                      <button
                        type="button"
                        onClick={() => changeSeats(room.settings.maxPlayers - 1)}
                        disabled={!connected || room.settings.maxPlayers <= fewestSeats}
                        aria-label="Fewer seats"
                      >
                        −
                      </button>
                      <span>{room.settings.maxPlayers}</span>
                      <button
                        type="button"
                        onClick={() => changeSeats(room.settings.maxPlayers + 1)}
                        disabled={!connected || room.settings.maxPlayers >= 8}
                        aria-label="More seats"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                <p className="game-spec">{spec}</p>

                <button
                  className="button button-primary button-xl start-button"
                  onClick={onStart}
                  disabled={startDisabled}
                >
                  {startLabel}
                </button>
              </>
            ) : (
              <>
                <h2>{host ? `Waiting for ${host.name}.` : 'Waiting for the host.'}</h2>
                <p className="waiting-copy">
                  {host ? `${host.name} picks the game and starts it.` : 'Not here yet.'}
                </p>
                <div className="waiting-bar" aria-hidden="true">
                  <span />
                </div>
                <p className="game-spec">{spec}</p>
              </>
            )}
          </section>
        </aside>
      </div>

      {isHost && (!duo || connectedCount === 2) && (
        <div className="mobile-start-bar">
          <span>
            {solitaire
              ? `${gameMeta.label} · ${game === 'klondike' ? `draw ${room.settings.klondikeDraw}` : 'free cells'}`
              : mahjong
                ? `${gameMeta.label} · ${MAHJONG_LAYOUTS[room.settings.mahjongLayout].label}`
                : sudoku
                  ? `Sudoku · ${difficulty.label}`
                  : `${presetLabel} · ${room.settings.width}×${room.settings.height}`}
          </span>
          <button className="button button-primary" onClick={onStart} disabled={startDisabled}>
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
