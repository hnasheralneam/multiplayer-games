import type { PublicPlayer } from '../../shared/types';

export interface SudokuEntryView {
  digit: number;
  by: string;
  wrong: boolean;
}

interface SudokuBoardProps {
  givens: number[];
  entries: Map<number, SudokuEntryView>;
  players: Map<string, PublicPlayer>;
  selected: number | null;
  onSelect?: (i: number) => void;
  recent?: number | null;
}

function rowOf(i: number): number {
  return Math.floor(i / 9);
}

function colOf(i: number): number {
  return i % 9;
}

function boxOf(i: number): number {
  return Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);
}

export function SudokuBoard({
  givens,
  entries,
  players,
  selected,
  onSelect,
  recent
}: SudokuBoardProps) {
  const selectedDigit =
    selected === null ? 0 : givens[selected] || entries.get(selected)?.digit || 0;

  return (
    <div className="sudoku-board" role="grid" aria-label="Shared Sudoku board">
      {Array.from({ length: 81 }, (_, i) => {
        const given = givens[i] ?? 0;
        const entry = entries.get(i);
        const digit = given || entry?.digit || 0;
        const wrong = Boolean(entry?.wrong);
        const owner = entry ? players.get(entry.by) : undefined;
        const selectedCell = selected === i;
        const inScope =
          selected !== null &&
          !selectedCell &&
          (rowOf(selected) === rowOf(i) ||
            colOf(selected) === colOf(i) ||
            boxOf(selected) === boxOf(i));
        const sameDigit = Boolean(selectedDigit && digit === selectedDigit && !selectedCell);
        const classes = [
          'sudoku-cell',
          given ? 'sudoku-given' : '',
          entry && !wrong ? 'sudoku-entry' : '',
          wrong ? 'sudoku-wrong' : '',
          inScope ? 'sudoku-scope' : '',
          sameDigit ? 'sudoku-same' : '',
          selectedCell ? 'sudoku-selected' : '',
          recent === i ? 'sudoku-recent' : '',
          colOf(i) === 2 || colOf(i) === 5 ? 'sudoku-box-right' : '',
          rowOf(i) === 2 || rowOf(i) === 5 ? 'sudoku-box-bottom' : ''
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <button
            key={i}
            type="button"
            role="gridcell"
            className={classes}
            aria-label={`Row ${rowOf(i) + 1}, column ${colOf(i) + 1}${digit ? `, ${digit}${wrong ? ', wrong' : given ? ', given' : ''}` : ', empty'}`}
            aria-selected={selectedCell}
            tabIndex={selected === null ? (i === 0 ? 0 : -1) : selectedCell ? 0 : -1}
            disabled={!onSelect}
            onClick={() => onSelect?.(i)}
          >
            {digit ? <span>{digit}</span> : null}
            {owner && !given ? (
              <i className="sudoku-owner" style={{ background: owner.color }} aria-hidden="true" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
