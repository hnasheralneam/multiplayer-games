import { useEffect, useState } from 'react';
import { GAME_META, type PublicRoom, type You } from '../../shared/types';
import { MAHJONG_LAYOUTS, hasFreeMatch, mahjongTilesLeft } from '../../shared/mahjong';
import { GameHud, HudEndGame, HudMode, HudTimer } from './GameHud';
import { useNow } from './ui';
import { GameIcon } from './GameIcon';
import { PlayerStrip } from './PlayerStrip';
import { MahjongBoard } from './MahjongBoard';

export interface MahjongGameProps {
  room: PublicRoom;
  you: You;
  connected: boolean;
  serverOffset: number;
  onMatch: (a: number, b: number) => void;
  onShuffle: () => void;
  onSelect: (i: number | null) => void;
  onCursor: (x: number, y: number) => void;
  onEndGame?: () => void;
}

export function MahjongGame({
  room,
  you,
  connected,
  serverOffset,
  onMatch,
  onShuffle,
  onSelect,
  onCursor,
  onEndGame
}: MahjongGameProps) {
  const mahjong = room.mahjong;
  const now = useNow(200);
  const serverNow = now + serverOffset;
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    setSelected(null);
  }, [mahjong?.id]);

  useEffect(() => {
    if (!mahjong || selected === null) return;
    if (mahjong.tiles[selected] < 0) setSelected(null);
  }, [mahjong, selected]);

  if (!mahjong) return null;
  const meta = GAME_META[room.settings.game];
  const layout = MAHJONG_LAYOUTS[mahjong.layout];
  const total = mahjong.tiles.length;
  const left = mahjongTilesLeft(mahjong.tiles);
  const matched = total - left;
  const resuming = Boolean(room.resumeAt && serverNow < room.resumeAt);
  const canPlay =
    connected && room.status === 'playing' && you.role === 'player' && !resuming;
  const paused = Boolean(room.pausedAt) && room.status === 'playing';
  const endedAt = mahjong.endedAt ?? serverNow;
  const elapsed = Math.max(0, endedAt - mahjong.startedAt);
  const final = room.status === 'results' && room.lastResult?.game === 'mahjong';
  const stuck = !final && left > 0 && !hasFreeMatch(mahjong.layout, mahjong.tiles);

  // Keep the local pick snappy but record it on the shared table so everyone
  // sees which tile each player is considering.
  const choose = (index: number | null) => {
    setSelected(index);
    onSelect(index);
  };

  const playersById = new Map(room.players.map((player) => [player.id, player]));
  const selectionsByTile = new Map<number, Array<{ id: string; color: string; name: string }>>();
  for (const selection of mahjong.selections) {
    if (selection.by === you.id) continue;
    if (mahjong.tiles[selection.i] < 0) continue;
    const player = playersById.get(selection.by);
    if (!player) continue;
    const list = selectionsByTile.get(selection.i) ?? [];
    list.push({ id: player.id, color: player.color, name: player.name });
    selectionsByTile.set(selection.i, list);
  }

  return (
    <section className={`mahjong-game ${final ? 'mahjong-game-final' : ''}`} aria-label={meta.label}>
      <GameHud
        left={
          <>
            {paused && <span className="live-pill">PAUSED</span>}
            <HudTimer seconds={elapsed / 1000} />
            <HudMode icon={<GameIcon game="mahjong" size={14} />}>
              {meta.label} · {layout.label}
            </HudMode>
          </>
        }
        center={
          <span className="hud-progress" aria-live="polite">
            <strong>{matched}</strong>
            <span>/{total} matched</span>
            {mahjong.moves > 0 && <em>{mahjong.moves} moves</em>}
          </span>
        }
        right={
          <>
            <span>
              {left} left
              {mahjong.shuffles > 0 &&
                ` · ${mahjong.shuffles} ${mahjong.shuffles === 1 ? 'shuffle' : 'shuffles'}`}
            </span>
            {onEndGame && you.id === room.hostId && <HudEndGame onClick={onEndGame} />}
          </>
        }
      />

      <PlayerStrip players={room.players} you={you} />

      <div className="mahjong-layout">
        <div className="mahjong-stage">
          <MahjongBoard
            mahjong={mahjong}
            selected={selected}
            disabled={!canPlay}
            selectionsByTile={selectionsByTile}
            onSelect={choose}
            onMatch={onMatch}
            onCursor={onCursor}
          />

          {stuck && (
            <div className="mahjong-stuck" role="status">
              <span>No matches left in the stack.</span>
              <button
                type="button"
                className="button button-secondary"
                onClick={onShuffle}
                disabled={!canPlay}
              >
                Shuffle the {left} tiles
              </button>
            </div>
          )}
          {resuming && (
            <div className="mahjong-overlay">
              <span>Table resuming…</span>
            </div>
          )}
          {final && (
            <div className="mahjong-overlay mahjong-solved">
              <span>Cleared.</span>
            </div>
          )}
        </div>

        <aside className="mahjong-side" aria-label="Mahjongg help">
          <span className="mahjong-side-kicker">How to match</span>
          <p className="mahjong-help">
            Find two matching tiles that each have an open left or right edge and nothing
            resting on top, then tap both. Nothing marks which tiles are free — reading the
            edges of the stack is the game. Your pick gets a ring; a tablemate's pick is
            outlined in their color. Buried tiles just shake when you try them.
          </p>
          <div className="mahjong-side-stats">
            <div>
              <span>Tiles left</span>
              <strong>{left}</strong>
            </div>
            <div>
              <span>Matched</span>
              <strong>{matched}/{total}</strong>
            </div>
            <div>
              <span>Shuffles</span>
              <strong>{mahjong.shuffles}</strong>
            </div>
          </div>
          <p className="mahjong-help mahjong-help-shared">
            One shared stack, no turns. Anyone can claim the next pair. Flowers match any
            flower, seasons any season.
          </p>
        </aside>
      </div>
    </section>
  );
}
