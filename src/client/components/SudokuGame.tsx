import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import {
  SUDOKU_DIFFICULTIES,
  type PublicRoom,
  type You
} from '../../shared/types';
import { formatClock } from '../lib/format';
import { useNow } from './ui';
import { IconClock, IconSudoku } from './icons';
import { PlayerStrip } from './PlayerStrip';
import { SudokuBoard, type SudokuEntryView } from './SudokuBoard';

export interface SudokuGameProps {
  room: PublicRoom;
  you: You;
  connected: boolean;
  serverOffset: number;
  sudokuRecent: { i: number; seq: number } | null;
  onEntry: (i: number, digit: number) => void;
}

function firstEmpty(givens: number[]): number | null {
  for (let i = 0; i < 81; i += 1) {
    if (!givens[i]) return i;
  }
  return null;
}

export function SudokuGame({
  room,
  you,
  connected,
  serverOffset,
  sudokuRecent,
  onEntry
}: SudokuGameProps) {
  const sudoku = room.sudoku;
  const now = useNow(200);
  const serverNow = now + serverOffset;
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    if (sudoku) setSelected(firstEmpty(sudoku.givens));
  }, [sudoku?.id]);

  const entries = useMemo(() => {
    const map = new Map<number, SudokuEntryView>();
    for (const entry of sudoku?.entries ?? []) {
      map.set(entry.i, { digit: entry.digit, by: entry.by, wrong: entry.wrong });
    }
    return map;
  }, [sudoku?.entries]);

  const players = useMemo(
    () => new Map(room.players.map((player) => [player.id, player])),
    [room.players]
  );

  if (!sudoku) return null;

  const resuming = Boolean(room.resumeAt && serverNow < room.resumeAt);
  const canPlay =
    connected && room.status === 'playing' && you.role === 'player' && !resuming;
  const endedAt = sudoku.endedAt ?? serverNow;
  const elapsed = Math.max(0, endedAt - sudoku.startedAt);
  const givensCount = sudoku.givens.filter(Boolean).length;
  const filled = givensCount + entries.size;
  const wrongCells = [...entries.values()].filter((entry) => entry.wrong).length;
  const remaining = 81 - filled;
  const selectedGiven = selected !== null && Boolean(sudoku.givens[selected]);
  const selectedDigit =
    selected === null ? 0 : sudoku.givens[selected] || entries.get(selected)?.digit || 0;
  const final = room.status === 'results' && room.lastResult?.game === 'sudoku';

  const digitCounts = new Map<number, number>();
  for (let digit = 1; digit <= 9; digit += 1) digitCounts.set(digit, 0);
  for (const digit of sudoku.givens) {
    if (digit) digitCounts.set(digit, (digitCounts.get(digit) ?? 0) + 1);
  }
  for (const entry of entries.values()) {
    if (!entry.wrong) digitCounts.set(entry.digit, (digitCounts.get(entry.digit) ?? 0) + 1);
  }

  const choose = (i: number) => {
    if (!resuming) setSelected(i);
  };

  const put = (digit: number) => {
    if (!canPlay || selected === null || selectedGiven) return;
    onEntry(selected, digit);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (/^[1-9]$/.test(event.key)) {
      event.preventDefault();
      put(Number(event.key));
      return;
    }
    if (event.key === 'Backspace' || event.key === 'Delete' || event.key === '0') {
      event.preventDefault();
      if (canPlay && selected !== null && !selectedGiven && entries.has(selected)) {
        onEntry(selected, 0);
      }
      return;
    }
    if (event.key.startsWith('Arrow') && selected !== null) {
      event.preventDefault();
      const row = Math.floor(selected / 9);
      const col = selected % 9;
      let nextRow = row;
      let nextCol = col;
      if (event.key === 'ArrowUp') nextRow = Math.max(0, row - 1);
      if (event.key === 'ArrowDown') nextRow = Math.min(8, row + 1);
      if (event.key === 'ArrowLeft') nextCol = Math.max(0, col - 1);
      if (event.key === 'ArrowRight') nextCol = Math.min(8, col + 1);
      setSelected(nextRow * 9 + nextCol);
    }
  };

  return (
    <section className={`sudoku-game ${final ? 'sudoku-game-final' : ''}`} aria-label="Sudoku">
      <div className="game-hud sudoku-hud">
        <div className="hud-left">
          <span className="hud-timer">
            <IconClock size={15} />
            {formatClock(elapsed / 1000)}
          </span>
          <span className="sudoku-mode">
            <IconSudoku size={14} />
            SUDOKU · {SUDOKU_DIFFICULTIES[sudoku.difficulty].label}
          </span>
        </div>
        <div className="sudoku-progress" aria-live="polite">
          <strong>{filled}</strong>
          <span>/ 81</span>
          {wrongCells > 0 && <em>{wrongCells} red</em>}
        </div>
        <div className="hud-right">
          <span>{remaining} left</span>
        </div>
      </div>

      <PlayerStrip players={room.players} you={you} />

      <div className="sudoku-layout">
        <div className="sudoku-stage" onKeyDown={onKeyDown}>
          <SudokuBoard
            givens={sudoku.givens}
            entries={entries}
            players={players}
            selected={selected}
            onSelect={choose}
            recent={sudokuRecent?.i ?? null}
          />
          {resuming && (
            <div className="sudoku-overlay">
              <span>Board resuming…</span>
            </div>
          )}
          {final && (
            <div className="sudoku-overlay sudoku-solved">
              <span>Solved.</span>
            </div>
          )}
        </div>

        <aside className="sudoku-side" aria-label="Number pad">
          <div className="sudoku-side-head">
            <span>{selected === null ? 'Pick a cell' : selectedGiven ? 'Given' : `Row ${Math.floor(selected / 9) + 1}, col ${(selected % 9) + 1}`}</span>
            <span className="sudoku-side-digit">{selectedDigit || '·'}</span>
          </div>
          <div className="sudoku-pad">
            {Array.from({ length: 9 }, (_, index) => {
              const digit = index + 1;
              const placed = digitCounts.get(digit) ?? 0;
              return (
                <button
                  key={digit}
                  type="button"
                  className={`sudoku-key ${placed >= 9 ? 'sudoku-key-done' : ''}`}
                  onClick={() => put(digit)}
                  disabled={!canPlay || selected === null || selectedGiven}
                  aria-label={`Enter ${digit}`}
                >
                  <strong>{digit}</strong>
                  <span>{Math.max(0, 9 - placed)}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="sudoku-erase"
            onClick={() => {
              if (canPlay && selected !== null && !selectedGiven && entries.has(selected)) {
                onEntry(selected, 0);
              }
            }}
            disabled={!canPlay || selected === null || selectedGiven || !entries.has(selected)}
          >
            Erase
          </button>
          <p className="sudoku-help">
            Tap a cell, then a number. Arrow keys and 1–9 work too.
          </p>
          <div className="sudoku-legend">
            <span><i className="legend-dot legend-given" /> given</span>
            <span><i className="legend-dot legend-entry" /> filled</span>
            <span><i className="legend-dot legend-wrong" /> needs fixing</span>
          </div>
        </aside>
      </div>
    </section>
  );
}
