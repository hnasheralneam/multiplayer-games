import { useMemo, useState, type ReactNode } from 'react';
import {
  GAME_META,
  SUDOKU_DIFFICULTIES,
  type Avatar as AvatarType,
  type MahjongResult,
  type PublicPlayer,
  type PublicRoom,
  type RoundResult,
  type SolitaireResult,
  type SudokuResult,
  type You
} from '../../shared/types';
import { MAHJONG_LAYOUTS } from '../../shared/mahjong';
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

interface StatRowView {
  key: string;
  avatar: AvatarType;
  color: string;
  name: string;
  you: boolean;
  badge?: string;
  share?: number;
  primary: ReactNode;
  secondary?: ReactNode;
}

interface ResultView {
  won: boolean;
  icon: ReactNode;
  eyebrow: string;
  headline: string;
  lede: string;
  metrics: Array<[string, ReactNode]>;
  statsTitle: string;
  primaryLabel: string;
  secondaryLabel: string | null;
  rows: StatRowView[];
  copyText: string;
  boardTitle: string;
  boardLabel: string;
  board: ReactNode;
  hasBoard: boolean;
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
        {isHost
          ? `Auto-returns in ${remaining}s. Pick the next game together.`
          : 'The host can stay or pick a new game.'}
      </span>
    </div>
  );
}

function playersMap(room: PublicRoom): Map<string, PublicPlayer> {
  return new Map(room.players.map((player) => [player.id, player]));
}

function minesweeperView(
  result: RoundResult,
  room: PublicRoom,
  you: You
): ResultView {
  const boardWidth = room.round?.width ?? room.settings.width;
  const boardHeight = room.round?.height ?? room.settings.height;
  const won = result.result === 'won';
  const minesHit = result.stats.reduce((sum, stat) => sum + stat.minesHit, 0);
  return {
    won,
    icon: won ? <IconCrown size={28} /> : <IconSkull size={28} />,
    eyebrow: won ? 'Round cleared' : 'Out of lives',
    headline: won ? 'Board cleared.' : 'Boom.',
    lede: won
      ? minesHit === 0
        ? 'Flawless. Not a single mine touched.'
        : `The table made it with ${result.livesLeft} ${plural(result.livesLeft, 'life', 'lives')} to spare.`
      : 'The last heart is gone. The board gets the last word.',
    metrics: [
      ['Time', formatClock(result.durationMs / 1000)],
      ['Lives left', `${result.livesLeft}/${result.startingLives}`],
      ['Mines hit', String(minesHit)],
      ['Cells', `${result.revealed.length}/${boardWidth * boardHeight}`]
    ],
    statsTitle: 'Swept by',
    primaryLabel: 'Flags',
    secondaryLabel: 'Mines',
    rows: result.stats.map((stat, index) => ({
      key: stat.playerId,
      avatar: stat.avatar,
      color: stat.color,
      name: stat.name,
      you: stat.playerId === you.id,
      badge: index === 0 && result.stats.length > 1 ? 'most swept' : undefined,
      share: stat.share,
      primary: (
        <>
          <IconFlag size={15} /> {stat.flags}
        </>
      ),
      secondary: (
        <>
          <IconMine size={13} /> {stat.minesHit}
        </>
      )
    })),
    copyText: (() => {
      const lives = `${result.livesLeft} ${plural(result.livesLeft, 'life', 'lives')} left`;
      const players = result.stats
        .map((stat) => `${stat.avatar} ${stat.name} ${percent(stat.share)}`)
        .join(' · ');
      return `💣 Minesweeper — ${won ? 'cleared' : 'boom'}\n🕒 ${formatClock(result.durationMs / 1000)} · ❤️ ${lives}\n${players}`;
    })(),
    boardTitle: 'Final board',
    boardLabel: 'board',
    hasBoard: true,
    board: (
      <div className="final-board">
        <Board
          width={boardWidth}
          height={boardHeight}
          revealed={new Map((result.revealed ?? []).map((cell) => [cell.i, cell.n] as const))}
          flags={new Map((result.flags ?? []).map((flag) => [flag.i, flag.by] as const))}
          players={playersMap(room)}
          meId={you.id}
          mode="reveal"
          disabled
          onReveal={() => undefined}
          onFlag={() => undefined}
          onChord={() => undefined}
          recent={new Map()}
          stale={null}
          mines={new Set(result.mines ?? [])}
          final
          showCursors={false}
        />
      </div>
    )
  };
}

function sudokuView(result: SudokuResult, room: PublicRoom, you: You): ResultView {
  const difficulty = SUDOKU_DIFFICULTIES[result.difficulty].label;
  const totalMistakes = result.stats.reduce((sum, stat) => sum + stat.wrong, 0);
  const entries = new Map<number, SudokuEntryView>();
  for (const entry of result.entries) {
    entries.set(entry.i, { digit: entry.digit, by: entry.by, wrong: entry.wrong });
  }
  return {
    won: true,
    icon: <IconSudoku size={28} />,
    eyebrow: 'Sudoku solved',
    headline: 'Grid complete.',
    lede: `${difficulty} · ${formatClock(result.durationMs / 1000)} · ${result.stats.length} ${plural(result.stats.length, 'player', 'players')} at the table.`,
    metrics: [
      ['Time', formatClock(result.durationMs / 1000)],
      ['Difficulty', difficulty],
      ['Filled', '81/81'],
      ['Mistakes', String(totalMistakes)]
    ],
    statsTitle: 'Filled by',
    primaryLabel: 'Correct',
    secondaryLabel: 'Mistakes',
    rows: result.stats.map((stat, index) => ({
      key: stat.playerId,
      avatar: stat.avatar,
      color: stat.color,
      name: stat.name,
      you: stat.playerId === you.id,
      badge: index === 0 && result.stats.length > 1 ? 'most filled' : undefined,
      primary: stat.correct,
      secondary: stat.wrong
    })),
    copyText: (() => {
      const players = result.stats
        .map((stat) => `${stat.avatar} ${stat.name} ${stat.correct}`)
        .join(' · ');
      return `🧩 Sudoku ${difficulty} — solved\n🕒 ${formatClock(result.durationMs / 1000)} · ${result.stats.length} players\n${players}`;
    })(),
    boardTitle: 'Solved grid',
    boardLabel: 'grid',
    hasBoard: true,
    board: (
      <div className="final-board">
        <SudokuBoard
          givens={result.givens}
          entries={entries}
          players={playersMap(room)}
          selected={null}
        />
      </div>
    )
  };
}

function solitaireView(result: SolitaireResult, room: PublicRoom, you: You): ResultView {
  const label = GAME_META[result.game].label;
  return {
    won: true,
    icon: <GameIcon game={result.game} size={28} />,
    eyebrow: `${label} solved`,
    headline: 'Every card home.',
    lede:
      result.game === 'klondike'
        ? `Draw ${result.draw} · ${formatClock(result.durationMs / 1000)} · ${result.stats.length} ${plural(result.stats.length, 'player', 'players')} at the table.`
        : `Four free cells, no stock · ${formatClock(result.durationMs / 1000)} · ${result.stats.length} ${plural(result.stats.length, 'player', 'players')} at the table.`,
    metrics: [
      ['Time', formatClock(result.durationMs / 1000)],
      ['Moves', String(result.moves)],
      ['Passes', String(result.passes)],
      [result.game === 'klondike' ? 'Draw' : 'Home', result.game === 'klondike' ? String(result.draw) : '52/52']
    ],
    statsTitle: 'Moved by',
    primaryLabel: 'Moves',
    secondaryLabel: null,
    rows: result.stats.map((stat, index) => ({
      key: stat.playerId,
      avatar: stat.avatar,
      color: stat.color,
      name: stat.name,
      you: stat.playerId === you.id,
      badge: index === 0 && result.stats.length > 1 ? 'most moves' : undefined,
      primary: stat.moves
    })),
    copyText: (() => {
      const players = result.stats
        .map((stat) => `${stat.avatar} ${stat.name} ${stat.moves}`)
        .join(' · ');
      return `🃏 ${label} — solved\n🕒 ${formatClock(result.durationMs / 1000)} · ${result.moves} moves · ${result.passes} passes\n${players}`;
    })(),
    boardTitle: 'Final table',
    boardLabel: 'table',
    hasBoard: Boolean(room.solitaire),
    board: room.solitaire ? (
      <div className="final-board">
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
    ) : null
  };
}

function mahjongView(result: MahjongResult, _room: PublicRoom, you: You): ResultView {
  const layout = MAHJONG_LAYOUTS[result.layout];
  const totalShuffles = result.shuffles;
  return {
    won: true,
    icon: <GameIcon game="mahjong" size={28} />,
    eyebrow: 'Mahjongg cleared',
    headline: 'Stack cleared.',
    lede: `${layout.label} · ${formatClock(result.durationMs / 1000)} · ${result.stats.length} ${plural(result.stats.length, 'player', 'players')} at the table.`,
    metrics: [
      ['Time', formatClock(result.durationMs / 1000)],
      ['Layout', layout.label],
      ['Moves', String(result.moves)],
      ['Shuffles', String(totalShuffles)]
    ],
    statsTitle: 'Matched by',
    primaryLabel: 'Matches',
    secondaryLabel: null,
    rows: result.stats.map((stat, index) => ({
      key: stat.playerId,
      avatar: stat.avatar,
      color: stat.color,
      name: stat.name,
      you: stat.playerId === you.id,
      badge: index === 0 && result.stats.length > 1 ? 'most matches' : undefined,
      primary: stat.matches
    })),
    copyText: (() => {
      const players = result.stats
        .map((stat) => `${stat.avatar} ${stat.name} ${stat.matches}`)
        .join(' · ');
      return `🀄 Mahjongg ${layout.label} — cleared\n🕒 ${formatClock(result.durationMs / 1000)} · ${result.moves} moves · ${result.shuffles} shuffles\n${players}`;
    })(),
    boardTitle: 'Cleared stack',
    boardLabel: 'stack',
    hasBoard: false,
    board: null
  };
}

function ResultsCard({
  room,
  you,
  connected,
  serverOffset,
  view,
  onLobby,
  onInvite,
  onLeave
}: ResultsProps & { view: ResultView }) {
  const [copied, setCopied] = useState(false);
  const [showBoard, setShowBoard] = useState(false);
  const isHost = room.hostId === you.id;

  const copy = async () => {
    const ok = await copyText(view.copyText);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    }
  };

  return (
    <div className={`results ${view.won ? 'results-won' : 'results-lost'}`}>
      {view.won && <Confetti />}
      <div className="results-card">
        <div className="results-hero">
          <span className="results-icon">{view.icon}</span>
          <span className="eyebrow">{view.eyebrow}</span>
          <h1>{view.headline}</h1>
          <p className="results-lede">{view.lede}</p>
        </div>

        <div className="result-metrics">
          {view.metrics.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>

        <div className="result-stats">
          <div className="result-stats-head">
            <span>{view.statsTitle}</span>
            <span>{view.primaryLabel}</span>
            <span>{view.secondaryLabel ?? ''}</span>
          </div>
          {view.rows.map((row) => (
            <div className="result-row" key={row.key}>
              <span className="result-player">
                <Avatar avatar={row.avatar} color={row.color} size={30} />
                <span className="result-name">
                  {row.name}
                  {row.you && <em>you</em>}
                  {row.badge && <span className="result-badge">{row.badge}</span>}
                </span>
                {row.share !== undefined && (
                  <span className="result-share">
                    <span className="result-bar">
                      <span
                        style={{ width: `${Math.max(2, row.share * 100)}%`, background: row.color }}
                      />
                    </span>
                    <strong>{percent(row.share)}</strong>
                  </span>
                )}
              </span>
              <span className="result-stat">{row.primary}</span>
              <span className="result-stat">{row.secondary}</span>
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
          {view.hasBoard && (
            <button className="button button-ghost" onClick={() => setShowBoard(true)}>
              <IconEye size={17} /> See the {view.boardLabel}
            </button>
          )}
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

      {view.hasBoard && (
        <Modal open={showBoard} onClose={() => setShowBoard(false)} title={view.boardTitle} wide>
          {view.board}
        </Modal>
      )}
    </div>
  );
}

export function Results({ room, you, connected, serverOffset, onLobby, onInvite, onLeave }: ResultsProps) {
  const result = room.lastResult;

  const view = useMemo<ResultView | null>(() => {
    if (!result) return null;
    if (result.game === 'sudoku') return sudokuView(result, room, you);
    if (result.game === 'klondike' || result.game === 'freecell') {
      return solitaireView(result, room, you);
    }
    if (result.game === 'mahjong') return mahjongView(result, room, you);
    if (result.game === 'minesweeper') return minesweeperView(result, room, you);
    return null;
  }, [result, room, you]);

  if (!result || !view) {
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

  return (
    <ResultsCard
      room={room}
      you={you}
      connected={connected}
      serverOffset={serverOffset}
      view={view}
      onLobby={onLobby}
      onInvite={onInvite}
      onLeave={onLeave}
    />
  );
}
