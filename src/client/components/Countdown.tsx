import type { CSSProperties } from 'react';
import { GAME_META, isSolitaireVariant, type PublicRoom, type You } from '../../shared/types';
import { Avatar, useNow } from './ui';
import { IconCrown, IconFlag, IconSudoku } from './icons';
import { GameIcon } from './GameIcon';

export function Countdown({
  room,
  you,
  serverOffset
}: {
  room: PublicRoom;
  you: You;
  serverOffset: number;
}) {
  const now = useNow(120);
  const serverNow = now + serverOffset;
  const remaining = room.countdownEndsAt
    ? Math.max(0, Math.ceil((room.countdownEndsAt - serverNow) / 1000))
    : 3;
  const host = room.players.find((player) => player.isHost);
  const presetLabel =
    room.settings.preset === 'cozy' ? 'Cozy' : room.settings.preset === 'big' ? 'Big' : 'Classic';
  const sudoku = room.settings.game === 'sudoku';
  const solitaire = isSolitaireVariant(room.settings.game);
  const ghostCols = sudoku ? 9 : solitaire ? (room.settings.game === 'freecell' ? 8 : 7) : room.settings.width;
  const ghostRows = sudoku ? 9 : solitaire ? 4 : room.settings.height;
  const ghostCount = sudoku
    ? 81
    : solitaire
      ? ghostCols * ghostRows
      : Math.min(room.settings.width * room.settings.height, 480);
  const sudokuLabel =
    room.settings.sudokuDifficulty === 'easy'
      ? 'Easy'
      : room.settings.sudokuDifficulty === 'hard'
        ? 'Hard'
        : 'Medium';

  return (
    <div className="countdown">
      <div className="countdown-stage">
        <div
          className="ghost-board"
          style={
            {
              '--cols': ghostCols,
              '--rows': ghostRows
            } as CSSProperties
          }
          aria-hidden="true"
        >
          {Array.from(
            { length: ghostCount },
            (_, index) => (
              <span key={index} />
            )
          )}
        </div>
        <div className="countdown-overlay">
          <span className="eyebrow">
            <GameIcon game={room.settings.game} size={15} />{' '}
            {host ? `${host.name} started the game` : 'Starting the game'}
          </span>
          <strong className="countdown-number" key={remaining}>
            {remaining > 0 ? remaining : 'Go'}
          </strong>
          <span className="countdown-sub">
            {sudoku
              ? `Sudoku · ${sudokuLabel} · one shared 9×9`
              : solitaire
                ? `${GAME_META[room.settings.game].label} · one shared table${room.settings.game === 'klondike' ? ` · draw ${room.settings.klondikeDraw}` : ' · all cards face up'}`
                : `${presetLabel} · ${room.settings.width}×${room.settings.height} · ${room.settings.lives} shared ${room.settings.lives === 1 ? 'life' : 'lives'}`}
          </span>
          <div className="countdown-players">
            {room.players.map((player) => (
              <span className="countdown-player" key={player.id}>
                <Avatar avatar={player.avatar} color={player.color} size={30} />
                {player.name}
                {player.isHost && <IconCrown size={12} />}
                {player.id === you.id && <em>you</em>}
              </span>
            ))}
          </div>
          <div className="countdown-tips">
            {sudoku ? (
              <>
                <span>
                  <IconSudoku size={16} /> Fill the grid together
                </span>
                <span>Red digits can be fixed</span>
              </>
            ) : solitaire ? (
              <>
                <span>
                  <GameIcon game={room.settings.game} size={16} /> Tap a card, then where it goes
                </span>
                <span>Double-tap sends it home</span>
              </>
            ) : (
              <>
                <span>
                  <IconFlag size={16} /> Hold to flag
                </span>
                <span>First click is safe</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
