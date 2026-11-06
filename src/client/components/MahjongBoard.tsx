import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  MAHJONG_LAYOUTS,
  freeTileIndices,
  mahjongTileCols,
  mahjongTileLayers,
  mahjongTileRows,
  tileFamily,
  tileGlyph,
  tileLabel,
  tilesMatch,
  type MahjongTilePos
} from '../../shared/mahjong';
import type { PublicMahjong } from '../../shared/types';
import { useCursorEmitter } from '../lib/cursors';
import { classNames } from '../lib/format';
import { PresenceLayer } from './PresenceLayer';

/** Vertical rise per layer, in cells (a tile is 2 cells tall). */
const LIFT = 0.5;

interface Props {
  mahjong: PublicMahjong;
  selected: number | null;
  disabled?: boolean;
  selectionsByTile?: Map<number, Array<{ id: string; color: string; name: string }>>;
  onSelect: (index: number | null) => void;
  onMatch: (a: number, b: number) => void;
  onCursor?: (x: number, y: number) => void;
}

function TileFace({ type }: { type: number }) {
  const family = tileFamily(type);
  if (family === 'circle' || family === 'bamboo') {
    const rank = (type % 9) + 1;
    return (
      <span
        className={`mj-face mj-face-${family} mj-face-rank${rank}`}
        aria-hidden="true"
      >
        {Array.from({ length: rank }, (_, pip) => (
          <i key={pip} className="mj-pip" />
        ))}
      </span>
    );
  }
  if (family === 'character') {
    return (
      <span className="mj-face mj-face-character" aria-hidden="true">
        <strong>{tileGlyph(type)}</strong>
        <span>萬</span>
      </span>
    );
  }
  if (family === 'dragon') {
    const variant = type - 31; // 0 red 中, 1 green 發, 2 white 白
    return (
      <span
        className={classNames(
          'mj-face',
          'mj-face-dragon',
          variant === 0 && 'mj-face-dragon-red',
          variant === 1 && 'mj-face-dragon-green',
          variant === 2 && 'mj-face-whitedragon'
        )}
        aria-hidden="true"
      >
        {variant === 2 ? null : tileGlyph(type)}
      </span>
    );
  }
  return (
    <span className={`mj-face mj-face-${family}`} aria-hidden="true">
      {tileGlyph(type)}
    </span>
  );
}

export function MahjongBoard({
  mahjong,
  selected,
  disabled = false,
  selectionsByTile,
  onSelect,
  onMatch,
  onCursor
}: Props) {
  const layout = MAHJONG_LAYOUTS[mahjong.layout];
  const cursorHandlers = useCursorEmitter(onCursor, disabled);
  const cols = mahjongTileCols(mahjong.layout);
  const rows = mahjongTileRows(mahjong.layout);
  const maxLayer = mahjongTileLayers(mahjong.layout) - 1;
  const totalRowsCells = rows * 2 + maxLayer * LIFT;

  const freeSet = useMemo(
    () => new Set(freeTileIndices(mahjong.layout, mahjong.tiles)),
    [mahjong.layout, mahjong.tiles]
  );

  const selectedType = selected !== null ? mahjong.tiles[selected] : -1;
  const [shakeIndex, setShakeIndex] = useState<number | null>(null);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (shakeTimer.current) clearTimeout(shakeTimer.current);
    };
  }, []);

  const shake = (index: number) => {
    if (shakeTimer.current) return; // one shake at a time
    setShakeIndex(index);
    shakeTimer.current = setTimeout(() => {
      shakeTimer.current = null;
      setShakeIndex(null);
    }, 340);
  };

  const clickTile = (index: number) => {
    if (disabled) return;
    if (!freeSet.has(index)) {
      shake(index);
      return;
    }
    if (selected === index) {
      onSelect(null);
      return;
    }
    if (selected !== null && selectedType >= 0 && tilesMatch(selectedType, mahjong.tiles[index])) {
      onMatch(selected, index);
      onSelect(null);
      return;
    }
    onSelect(index);
  };

  const tileStyle = (pos: MahjongTilePos): CSSProperties => ({
    left: `${(pos.x / (cols * 2)) * 100}%`,
    top: `${((pos.y - pos.l * LIFT + maxLayer * LIFT) / totalRowsCells) * 100}%`,
    zIndex: pos.l * 1000 + pos.y * 2 + pos.x
  });

  const boardStyle = {
    '--mj-cols': cols,
    '--mj-rows': totalRowsCells / 2,
    aspectRatio: `${cols * 2} / ${totalRowsCells}`
  } as CSSProperties;

  return (
    <div
      className="mahjong-board"
      style={boardStyle}
      aria-label="Mahjongg board"
      onPointerMove={cursorHandlers.onPointerMove}
      onPointerLeave={cursorHandlers.onPointerLeave}
    >
      {mahjong.tiles.map((type, index) => {
        if (type < 0) return null;
        const pos = layout.positions[index];
        const free = freeSet.has(index);
        const isSelected = selected === index;
        const remoteSelectors = selectionsByTile?.get(index) ?? [];
        const remoteLabel =
          remoteSelectors.length > 0
            ? `, selected by ${remoteSelectors.map((selector) => selector.name).join(', ')}`
            : '';
        return (
          <button
            key={index}
            type="button"
            className={classNames(
              'mj-tile',
              `mj-tile-l${pos.l}`,
              isSelected && 'mj-tile-selected',
              shakeIndex === index && 'mj-tile-shake'
            )}
            style={tileStyle(pos)}
            data-index={index}
            onClick={() => clickTile(index)}
            disabled={disabled}
            aria-disabled={!free}
            aria-label={`${tileLabel(type)}${free ? '' : ', covered'}${remoteLabel}`}
            aria-pressed={isSelected}
          >
            <TileFace type={type} />
            {remoteSelectors.length > 0 && (
              <span className="mj-tile-remote-outlines" aria-hidden="true">
                {remoteSelectors.map((selector, ring) => (
                  <span
                    key={selector.id}
                    className="mj-tile-remote-outline"
                    style={{ borderColor: selector.color, inset: `${-2 - ring * 2}px` }}
                  />
                ))}
              </span>
            )}
          </button>
        );
      })}
      {onCursor && <PresenceLayer />}
    </div>
  );
}
