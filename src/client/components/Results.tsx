import { useMemo, useState } from 'react';
import {
  GAME_META,
  SUDOKU_DIFFICULTIES,
  type PublicPlayer,
  type PublicRoom,
  type RoundResult,
  type SolitaireResult,
  type SudokuResult,
  type You
} from '../../shared/types';
import { copyText } from '../lib/copy';
import { formatClock, percent, plural } from '../lib/format';
import { Board } from './Board';
import { SolitaireBoard } from './SolitaireBoard';
import { SudokuBoard, type SudokuEntryView } from './SudokuBoard';
import { Avatar, Confetti, Modal, useNow } from './ui';
import { GameIcon } from './GameIcon';
import {
  IconCheck,
  IconCopy,
  IconCrown,
  IconEye,
  IconFlag,
  IconMine,
  IconShare,
  IconSkull,
  IconSudoku
} from './icons';

interface ResultsProps {
  room: PublicRoom;
  you: You;
  connected: boolean;
  serverOffset: number;
  onLobby: () => void;
  onInvite: () => void;
  onLeave: () => void;
}

function LobbyReturn({
  room,
  connected,
  serverOffset,
  isHost,
  onLobby
}: {
  room: PublicRoom;
  connected: boolean;
  serverOffset: number;
  isHost: boolean;
  onLobby: () => void;
}) {
  const now = useNow(250);
  const remaining = room.resultsEndsAt
    ? Math.max(0, Math.ceil((room.resultsEndsAt - (now + serverOffset)) / 1000))
    : 12;

  return (
    <div className="lobby-return">
      {isHost ? (
        <button
          className="button button-primary button-xl"
          onClick={onLobby}
          disabled={!connected}
        >
          Back to the lobby
        </button>
      ) : (
        <div className="lobby-return-wait">
          <span>Back to the lobby</span>
          <strong>{remaining}s</strong>
        </div>
      )}
      <span className="lobby-return-note">
        {isHost ? `Auto-returns in ${remaining}s. Pick the next game together.` : 'The host can stay or pick a new game.'}
      </span>
    </div>
  );
}

function resultText(result: RoundResult): string {
  const headline = result.result === 'won' ? 'Minesweeper — cleared' : 'Minesweeper — boom';
  const lives = `${result.livesLeft} ${plural(result.livesLeft, 'life', 'lives')} left`;
  const players = result.stats
    .map((stat) => `${stat.avatar} ${stat.name} ${percent(stat.share)}`)
    .join(' · ');
  return `💣 ${headline}\n🕒 ${formatClock(result.durationMs / 1000)} · ❤️ ${lives}\n${players}`;
}

export function Results(props: ResultsProps) {
  const result = props.room.lastResult;
  if (!result) {
    return (
      <div className="results">
        <div className="results-card">
          <span className="eyebrow">Results</span>
          <h1>Waiting for the board…</h1>
          <p className="results-lede">The final score will land here.</p>
        </div>
      </div>
    );
  }
  if (result.game === 'sudoku') {
    return <SudokuResults {...props} result={result} />;
  }
  if (result.game === 'klondike' || result.game === 'freecell') {
    return <SolitaireResults {...props} result={result} />;
  }
  if (result.game !== 'minesweeper') return null;
  return <MinesweeperResults {...props} result={result} />;
}

function MinesweeperResults({
  room,
  you,
  connected,
  serverOffset,
  result,
  onLobby,
  onInvite,
  onLeave
}: ResultsProps & { result: RoundResult }) {
  const [copied, setCopied] = useState(false);
  const [showBoard, setShowBoard] = useState(false);
  const isHost = room.hostId === you.id;

  const revealed = useMemo(
    () => new Map((result.revealed ?? []).map((cell) => [cell.i, cell.n] as const)),
    [result]
  );
  const flags = useMemo(
    () => new Map((result.flags ?? []).map((flag) => [flag.i, flag.by] as const)),
    [result]
  );
  const mines = useMemo(() => new Set(result.mines ?? []), [result]);
  const players = useMemo(
    () => new Map(room.players.map((player) => [player.id, player])),
    [room.players]
  );

  const boardWidth = room.round?.width ?? room.settings.width;
  const boardHeight = room.round?.height ?? room.settings.height;
  const won = result.result === 'won';
  const minesHit = result.stats.reduce((sum, stat) => sum + stat.minesHit, 0);
  const copy = async () => {
    const ok = await copyText(resultText(result));
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    }
  };

  return (
    <div className={`results ${won ? 'results-won' : 'results-lost'}`}>
      {won && <Confetti />}
      <div className="results-card">
        <div className="results-hero">
          <span className="results-icon">
            {won ? <IconCrown size={30} /> : <IconSkull size={30} />}
          </span>
          <span className="eyebrow">{won ? 'Round cleared' : 'Out of lives'}</span>
          <h1>{won ? 'Board cleared.' : 'Boom.'}</h1>
          <p className="results-lede">
            {won
              ? minesHit === 0
                ? 'Flawless. Not a single mine touched.'
                : `The table made it with ${result.livesLeft} ${plural(result.livesLeft, 'life', 'lives')} to spare.`
              : 'The last heart is gone. The board gets the last word.'}
          </p>
        </div>

        <div className="result-metrics">
          <div>
            <span>Time</span>
            <strong>{formatClock(result.durationMs / 1000)}</strong>
          </div>
          <div>
            <span>Lives left</span>
            <strong>
              {result.livesLeft}/{result.startingLives}
            </strong>
          </div>
          <div>
            <span>Mines hit</span>
            <strong>{minesHit}</strong>
          </div>
          <div>
            <span>Cells</span>
            <strong>
              {result.revealed.length}/{boardWidth * boardHeight}
            </strong>
          </div>
        </div>

        <div className="result-stats">
          <div className="result-stats-head">
            <span>Swept by</span>
            <span>Flags</span>
            <span>Mines</span>
          </div>
          {result.stats.map((stat, index) => (
            <div className="result-row" key={stat.playerId}>
              <span className="result-player">
                <Avatar avatar={stat.avatar} color={stat.color} size={32} />
                <span className="result-name">
                  {stat.name}
                  {stat.playerId === you.id && <em>you</em>}
                  {index === 0 && result.stats.length > 1 && (
                    <span className="result-badge">most swept</span>
                  )}
                </span>
                <span className="result-share">
                  <span className="result-bar">
                    <span style={{ width: `${Math.max(2, stat.share * 100)}%`, background: stat.color }} />
                  </span>
                  <strong>{percent(stat.share)}</strong>
                </span>
              </span>
              <span className="result-flag">
                <IconFlag size={17} /> {stat.flags}
              </span>
              <span className="result-mine">
                <IconMine size={14} /> {stat.minesHit}
              </span>
            </div>
          ))}
        </div>

        <LobbyReturn
          room={room}
          connected={connected}
          serverOffset={serverOffset}
          isHost={isHost}
          onLobby={onLobby}
        />

        <div className="results-actions">
          <button className="button button-secondary" onClick={() => void copy()}>
            {copied ? <IconCheck size={17} /> : <IconCopy size={17} />}
            {copied ? 'Copied' : 'Copy result'}
          </button>
          <button className="button button-ghost" onClick={() => setShowBoard(true)}>
            <IconEye size={17} /> See the board
          </button>
        </div>

        <div className="results-foot">
          <span>
            Room <strong>{room.code}</strong> stays open. Same table, next game.
          </span>
          <span className="results-foot-actions">
            <button className="text-button" onClick={onInvite}>
              <IconShare size={14} /> Invite someone
            </button>
            <button className="text-button" onClick={onLeave}>
              Leave
            </button>
          </span>
        </div>
      </div>

      <Modal open={showBoard} onClose={() => setShowBoard(false)} title="Final board" wide>
        <div className="final-board">
          <Board
            width={boardWidth}
            height={boardHeight}
            revealed={revealed}
            flags={flags}
            players={players}
            meId={you.id}
            mode="reveal"
            disabled
            onReveal={() => undefined}
            onFlag={() => undefined}
            onChord={() => undefined}
            recent={new Map()}
            stale={null}
            mines={mines}
            final
            showCursors={false}
          />
        </div>
      </Modal>
    </div>
  );
}

function solitaireResultText(result: SolitaireResult): string {
  const label = GAME_META[result.game].label;
  const players = result.stats
    .map((stat) => `${stat.avatar} ${stat.name} ${stat.moves}`)
    .join(' · ');
  return `🃏 ${label} — solved\n🕒 ${formatClock(result.durationMs / 1000)} · ${result.moves} moves · ${result.passes} passes\n${players}`;
}

function SolitaireResults({
  room,
  you,
  connected,
  serverOffset,
  result,
  onLobby,
  onInvite,
  onLeave
}: ResultsProps & { result: SolitaireResult }) {
  const [copied, setCopied] = useState(false);
  const [showBoard, setShowBoard] = useState(false);
  const isHost = room.hostId === you.id;
  const label = GAME_META[result.game].label;
  const copy = async () => {
    const ok = await copyText(solitaireResultText(result));
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    }
  };

  return (
    <div className="results results-won">
      <Confetti />
      <div className="results-card">
        <div className="results-hero">
          <span className="results-icon">
            <GameIcon game={result.game} size={30} />
          </span>
          <span className="eyebrow">{label} solved</span>
          <h1>Every card home.</h1>
          <p className="results-lede">
            {result.game === 'klondike'
              ? `Draw ${result.draw} · ${formatClock(result.durationMs / 1000)} · ${result.stats.length} ${plural(result.stats.length, 'player', 'players')} at the table.`
              : `Four free cells, no stock · ${formatClock(result.durationMs / 1000)} · ${result.stats.length} ${plural(result.stats.length, 'player', 'players')} at the table.`}
          </p>
        </div>

        <div className="result-metrics">
          <div>
            <span>Time</span>
            <strong>{formatClock(result.durationMs / 1000)}</strong>
          </div>
          <div>
            <span>Moves</span>
            <strong>{result.moves}</strong>
          </div>
          <div>
            <span>Passes</span>
            <strong>{result.passes}</strong>
          </div>
          <div>
            <span>{result.game === 'klondike' ? 'Draw' : 'Home'}</span>
            <strong>{result.game === 'klondike' ? result.draw : '52/52'}</strong>
          </div>
        </div>

        <div className="result-stats">
          <div className="result-stats-head sudoku-stats-head">
            <span>Moved by</span>
            <span>Moves</span>
            <span />
          </div>
          {result.stats.map((stat, index) => (
            <div className="result-row sudoku-result-row" key={stat.playerId}>
              <span className="result-player">
                <Avatar avatar={stat.avatar} color={stat.color} size={32} />
                <span className="result-name">
                  {stat.name}
                  {stat.playerId === you.id && <em>you</em>}
                  {index === 0 && result.stats.length > 1 && (
                    <span className="result-badge">most moves</span>
                  )}
                </span>
              </span>
              <span className="result-flag">{stat.moves}</span>
              <span className="result-mine" />
            </div>
          ))}
        </div>

        <LobbyReturn
          room={room}
          connected={connected}
          serverOffset={serverOffset}
          isHost={isHost}
          onLobby={onLobby}
        />

        <div className="results-actions">
          <button className="button button-secondary" onClick={() => void copy()}>
            {copied ? <IconCheck size={17} /> : <IconCopy size={17} />}
            {copied ? 'Copied' : 'Copy result'}
          </button>
          {room.solitaire && (
            <button className="button button-ghost" onClick={() => setShowBoard(true)}>
              <IconEye size={17} /> See the table
            </button>
          )}
        </div>

        <div className="results-foot">
          <span>
            Room <strong>{room.code}</strong> stays open. Pick the next game together.
          </span>
          <span className="results-foot-actions">
            <button className="text-button" onClick={onInvite}>
              <IconShare size={14} /> Invite someone
            </button>
            <button className="text-button" onClick={onLeave}>
              Leave
            </button>
          </span>
        </div>
      </div>

      {room.solitaire && (
        <Modal
          open={showBoard}
          onClose={() => setShowBoard(false)}
          title="Final table"
          wide
        >
          <div className="solitaire-final">
            <SolitaireBoard
              solitaire={room.solitaire}
              selected={null}
              disabled
              onSelect={() => undefined}
              onMove={() => undefined}
              onDraw={() => undefined}
              onRecycle={() => undefined}
              onAuto={() => undefined}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}

function sudokuResultText(result: SudokuResult): string {
  const difficulty = SUDOKU_DIFFICULTIES[result.difficulty].label;
  const players = result.stats
    .map((stat) => `${stat.avatar} ${stat.name} ${stat.correct}`)
    .join(' · ');
  return `🧩 Sudoku ${difficulty} — solved\n🕒 ${formatClock(result.durationMs / 1000)} · ${result.stats.length} players\n${players}`;
}

function SudokuResults({
  room,
  you,
  connected,
  serverOffset,
  result,
  onLobby,
  onInvite,
  onLeave
}: ResultsProps & { result: SudokuResult }) {
  const [copied, setCopied] = useState(false);
  const [showBoard, setShowBoard] = useState(false);
  const isHost = room.hostId === you.id;
  const players = useMemo(
    () => new Map(room.players.map((player) => [player.id, player])) as Map<string, PublicPlayer>,
    [room.players]
  );
  const entries = useMemo(() => {
    const map = new Map<number, SudokuEntryView>();
    for (const entry of result.entries) {
      map.set(entry.i, { digit: entry.digit, by: entry.by, wrong: entry.wrong });
    }
    return map;
  }, [result.entries]);
  const totalMistakes = result.stats.reduce((sum, stat) => sum + stat.wrong, 0);
  const copy = async () => {
    const ok = await copyText(sudokuResultText(result));
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    }
  };

  return (
    <div className="results results-won">
      <Confetti />
      <div className="results-card">
        <div className="results-hero">
          <span className="results-icon">
            <IconSudoku size={30} />
          </span>
          <span className="eyebrow">Sudoku solved</span>
          <h1>Grid complete.</h1>
          <p className="results-lede">
            {SUDOKU_DIFFICULTIES[result.difficulty].label} · {formatClock(result.durationMs / 1000)} ·{' '}
            {result.stats.length} {plural(result.stats.length, 'player', 'players')} at the table.
          </p>
        </div>

        <div className="result-metrics">
          <div>
            <span>Time</span>
            <strong>{formatClock(result.durationMs / 1000)}</strong>
          </div>
          <div>
            <span>Difficulty</span>
            <strong>{SUDOKU_DIFFICULTIES[result.difficulty].label}</strong>
          </div>
          <div>
            <span>Filled</span>
            <strong>81/81</strong>
          </div>
          <div>
            <span>Mistakes</span>
            <strong>{totalMistakes}</strong>
          </div>
        </div>

        <div className="result-stats">
          <div className="result-stats-head sudoku-stats-head">
            <span>Filled by</span>
            <span>Correct</span>
            <span>Mistakes</span>
          </div>
          {result.stats.map((stat, index) => (
            <div className="result-row sudoku-result-row" key={stat.playerId}>
              <span className="result-player">
                <Avatar avatar={stat.avatar} color={stat.color} size={32} />
                <span className="result-name">
                  {stat.name}
                  {stat.playerId === you.id && <em>you</em>}
                  {index === 0 && result.stats.length > 1 && (
                    <span className="result-badge">most filled</span>
                  )}
                </span>
              </span>
              <span className="result-flag">{stat.correct}</span>
              <span className="result-mine">{stat.wrong}</span>
            </div>
          ))}
        </div>

        <LobbyReturn
          room={room}
          connected={connected}
          serverOffset={serverOffset}
          isHost={isHost}
          onLobby={onLobby}
        />

        <div className="results-actions">
          <button className="button button-secondary" onClick={() => void copy()}>
            {copied ? <IconCheck size={17} /> : <IconCopy size={17} />}
            {copied ? 'Copied' : 'Copy result'}
          </button>
          <button className="button button-ghost" onClick={() => setShowBoard(true)}>
            <IconEye size={17} /> See the grid
          </button>
        </div>

        <div className="results-foot">
          <span>
            Room <strong>{room.code}</strong> stays open. Pick the next game together.
          </span>
          <span className="results-foot-actions">
            <button className="text-button" onClick={onInvite}>
              <IconShare size={14} /> Invite someone
            </button>
            <button className="text-button" onClick={onLeave}>
              Leave
            </button>
          </span>
        </div>
      </div>

      <Modal open={showBoard} onClose={() => setShowBoard(false)} title="Solved grid" wide>
        <div className="sudoku-final-board">
          <SudokuBoard
            givens={result.givens}
            entries={entries}
            players={players}
            selected={null}
          />
        </div>
      </Modal>
    </div>
  );
}
