import { useEffect, useState } from 'react';
import {
  GAME_META,
  KLONDIKE_DRAW_OPTIONS,
  LIVES_OPTIONS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PRESETS,
  PRESET_IDS,
  SUDOKU_DIFFICULTIES,
  SUDOKU_DIFFICULTY_IDS,
  isSolitaireVariant,
  type KlondikeDraw,
  type PresetId,
  type RoomSettings,
  type SudokuDifficulty
} from '../../shared/types';
import { Modal } from './ui';
import { IconCheck } from './icons';

export function SettingsSheet({
  open,
  onClose,
  settings,
  playerCount,
  onApply
}: {
  open: boolean;
  onClose: () => void;
  settings: RoomSettings;
  playerCount: number;
  onApply: (settings: RoomSettings) => void;
}) {
  const [preset, setPreset] = useState<PresetId>(settings.preset);
  const [lives, setLives] = useState(settings.lives);
  const [maxPlayers, setMaxPlayers] = useState(settings.maxPlayers);
  const [lateJoin, setLateJoin] = useState(settings.lateJoin);
  const [difficulty, setDifficulty] = useState<SudokuDifficulty>(settings.sudokuDifficulty);
  const [klondikeDraw, setKlondikeDraw] = useState<KlondikeDraw>(settings.klondikeDraw);

  useEffect(() => {
    if (!open) return;
    setPreset(settings.preset);
    setLives(settings.lives);
    setMaxPlayers(settings.maxPlayers);
    setLateJoin(settings.lateJoin);
    setDifficulty(settings.sudokuDifficulty);
    setKlondikeDraw(settings.klondikeDraw);
  }, [open, settings]);

  const apply = () => {
    const chosen = PRESETS[preset];
    onApply({
      game: settings.game,
      preset,
      width: chosen.width,
      height: chosen.height,
      mines: chosen.mines,
      lives,
      maxPlayers,
      lateJoin,
      sudokuDifficulty: difficulty,
      klondikeDraw
    });
    onClose();
  };

  const sudoku = settings.game === 'sudoku';
  const solitaire = isSolitaireVariant(settings.game);
  const title = sudoku
    ? 'Sudoku settings'
    : solitaire
      ? `${GAME_META[settings.game].label} settings`
      : 'Minesweeper settings';

  const lowestSeats = Math.max(MIN_PLAYERS, playerCount);

  return (
    <Modal open={open} onClose={onClose} title={title} wide>
      <div className="settings-body">
        {sudoku ? (
          <section className="settings-section">
            <div className="settings-label">
              <span>Difficulty</span>
              <span className="settings-hint">More clues make the shared grid easier.</span>
            </div>
            <div className="segmented">
              {SUDOKU_DIFFICULTY_IDS.map((id) => (
                <button
                  type="button"
                  key={id}
                  className={difficulty === id ? 'segmented-on' : ''}
                  onClick={() => setDifficulty(id)}
                  aria-pressed={difficulty === id}
                >
                  {SUDOKU_DIFFICULTIES[id].label} · {SUDOKU_DIFFICULTIES[id].clues}
                </button>
              ))}
            </div>
          </section>
        ) : solitaire ? (
          <section className="settings-section">
            <div className="settings-label">
              <span>{settings.game === 'klondike' ? 'Draw' : 'Deal'}</span>
              <span className="settings-hint">
                {settings.game === 'klondike'
                  ? 'How many cards come off the stock at a time.'
                  : 'FreeCell always deals all 52 cards face up, with four free cells.'}
              </span>
            </div>
            {settings.game === 'klondike' ? (
              <div className="segmented">
                {KLONDIKE_DRAW_OPTIONS.map((value) => (
                  <button
                    type="button"
                    key={value}
                    className={klondikeDraw === value ? 'segmented-on' : ''}
                    onClick={() => setKlondikeDraw(value)}
                    aria-pressed={klondikeDraw === value}
                  >
                    {value} card{value === 1 ? '' : 's'} · {value === 1 ? 'gentle' : 'classic'}
                  </button>
                ))}
              </div>
            ) : (
              <p className="settings-hint settings-solo-note">
                Every card is visible from the first tap. Four free cells hold a single card
                each, and the eight columns build down in alternating colours.
              </p>
            )}
          </section>
        ) : (
          <>
            <section className="settings-section">
              <div className="settings-label">
                <span>Board</span>
                <span className="settings-hint">The board is built when the round starts.</span>
              </div>
              <div className="preset-grid">
                {PRESET_IDS.map((id) => {
                  const item = PRESETS[id];
                  return (
                    <button
                      type="button"
                      key={id}
                      className={`preset-card ${preset === id ? 'preset-on' : ''}`}
                      onClick={() => setPreset(id)}
                      aria-pressed={preset === id}
                    >
                      <span className="preset-art" data-preset={id} aria-hidden="true" />
                      <span className="preset-name">
                        {item.label}
                        {preset === id && <IconCheck size={15} />}
                      </span>
                      <span className="preset-meta">
                        {item.width}×{item.height} · {item.mines} mines
                      </span>
                      <span className="preset-hint">{item.hint}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="settings-section">
              <div className="settings-label">
                <span>Shared lives</span>
                <span className="settings-hint">Every mine costs the table one heart.</span>
              </div>
              <div className="segmented">
                {LIVES_OPTIONS.map((value) => (
                  <button
                    type="button"
                    key={value}
                    className={lives === value ? 'segmented-on' : ''}
                    onClick={() => setLives(value)}
                    aria-pressed={lives === value}
                  >
                    {value} {value === 1 ? 'life' : 'lives'}
                  </button>
                ))}
              </div>
            </section>
          </>
        )}

        <section className="settings-section">
          <div className="settings-label">
            <span>Seats</span>
            <span className="settings-hint">At least {lowestSeats} for this table.</span>
          </div>
          <div className="seat-options">
            {Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, index) => index + MIN_PLAYERS).map(
              (value) => (
                <button
                  type="button"
                  key={value}
                  className={maxPlayers === value ? 'seat-on' : ''}
                  disabled={value < lowestSeats}
                  onClick={() => setMaxPlayers(value)}
                  aria-pressed={maxPlayers === value}
                >
                  {value}
                </button>
              )
            )}
          </div>
        </section>

        <section className="settings-section settings-inline">
          <div>
            <span className="settings-label-text">Allow late join</span>
            <span className="settings-hint">
              Friends can jump into a round that is already running.
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={lateJoin}
            className={`switch ${lateJoin ? 'switch-on' : ''}`}
            onClick={() => setLateJoin((value) => !value)}
          >
            <span />
          </button>
        </section>

        <div className="settings-actions">
          <button className="button button-ghost" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button button-primary" type="button" onClick={apply}>
            Save settings
          </button>
        </div>
      </div>
    </Modal>
  );
}
