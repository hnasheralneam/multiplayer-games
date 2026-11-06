import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  RANK_LABELS,
  SUITS,
  SUIT_SYMBOLS,
  cardLabel,
  cardRank,
  cardSuit,
  isRedCard,
  type PublicSolitaire,
  type SolitaireSlot
} from '../../shared/types';
import { canPlace, locateCard, movingCards } from '../../shared/solitaire';
import { useCursorEmitter } from '../lib/cursors';
import { classNames } from '../lib/format';
import { solitaireView } from '../lib/solitaireView';
import { IconRefresh } from './icons';
import { PresenceLayer } from './PresenceLayer';

interface Props {
  solitaire: PublicSolitaire;
  selected: number | null;
  disabled?: boolean;
  onSelect: (card: number | null) => void;
  onMove: (card: number, to: SolitaireSlot) => void;
  onDraw: () => void;
  onRecycle: () => void;
  onAuto: (card: number) => void;
  onCursor?: (x: number, y: number) => void;
}

type DropSource = SolitaireSlot | 'waste';
type CardLocation = NonNullable<ReturnType<typeof locateCard>>;

interface DragInfo {
  pointerId: number;
  card: number;
  cards: number[];
  roundId: string;
  origin: CardLocation;
  cardWidth: number;
  step: number;
  grabX: number;
  grabY: number;
  startX: number;
  startY: number;
  active: boolean;
}

interface DragView {
  card: number;
  cards: number[];
  x: number;
  y: number;
  grabX: number;
  grabY: number;
  step: number;
  cardWidth: number;
}

interface DragEvents {
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
}

function sameLocation(a: CardLocation, b: CardLocation): boolean {
  return a.zone === b.zone && a.index === b.index && a.position === b.position;
}

function sameCards(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((card, index) => card === b[index]);
}

function findCard(solitaire: PublicSolitaire, card: number): DropSource | null {
  for (let index = 0; index < solitaire.tableau.length; index += 1) {
    if (solitaire.tableau[index].includes(card)) return { zone: 'tableau', index };
  }
  if (solitaire.waste.includes(card)) return 'waste';
  for (let index = 0; index < solitaire.freeCells.length; index += 1) {
    if (solitaire.freeCells[index] === card) return { zone: 'freecell', index };
  }
  for (let index = 0; index < solitaire.foundations.length; index += 1) {
    if (solitaire.foundations[index].includes(card)) return { zone: 'foundation', index };
  }
  return null;
}

function dropTargetAt(x: number, y: number): SolitaireSlot | null {
  const hit = document.elementFromPoint(x, y);
  const drop = hit?.closest('[data-drop]')?.getAttribute('data-drop');
  if (!drop) return null;
  const separator = drop.indexOf(':');
  if (separator < 0) return null;
  const zone = drop.slice(0, separator);
  const index = Number(drop.slice(separator + 1));
  if (zone !== 'tableau' && zone !== 'foundation' && zone !== 'freecell') return null;
  if (!Number.isInteger(index)) return null;
  return { zone, index };
}

function CardFace({ card, className, style }: { card: number; className?: string; style?: CSSProperties }) {
  const red = isRedCard(card);
  const suit = cardSuit(card);
  const rank = RANK_LABELS[cardRank(card)];
  return (
    <span
      className={classNames(
        'solitaire-card',
        red ? 'solitaire-card-red' : 'solitaire-card-black',
        className
      )}
      style={style}
      aria-hidden="true"
    >
      <span className="solitaire-card-corner">
        <strong>{rank}</strong>
        <span>{SUIT_SYMBOLS[suit]}</span>
      </span>
      <span className="solitaire-card-pip">{SUIT_SYMBOLS[suit]}</span>
    </span>
  );
}

function PlayingCard({
  card,
  selected,
  disabled,
  dragging,
  dataCard,
  onCardClick,
  onCardDoubleClick,
  dragEvents
}: {
  card: number;
  selected: boolean;
  disabled: boolean;
  dragging: boolean;
  dataCard?: boolean;
  onCardClick: () => void;
  onCardDoubleClick: () => void;
  dragEvents?: DragEvents;
}) {
  const red = isRedCard(card);
  const suit = cardSuit(card);
  const rank = RANK_LABELS[cardRank(card)];
  return (
    <button
      type="button"
      data-card={dataCard ? card : undefined}
      className={classNames(
        'solitaire-card',
        red ? 'solitaire-card-red' : 'solitaire-card-black',
        selected && 'solitaire-card-selected',
        dragging && 'solitaire-card-dragging'
      )}
      onClick={(event) => {
        event.stopPropagation();
        onCardClick();
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onCardDoubleClick();
      }}
      {...dragEvents}
      disabled={disabled}
      aria-label={`Play ${cardLabel(card)}`}
      aria-pressed={selected}
    >
      <span className="solitaire-card-corner">
        <strong>{rank}</strong>
        <span>{SUIT_SYMBOLS[suit]}</span>
      </span>
      <span className="solitaire-card-pip">{SUIT_SYMBOLS[suit]}</span>
    </button>
  );
}

function CardBack({ count }: { count?: number }) {
  return (
    <span className="solitaire-card solitaire-card-back" aria-hidden="true">
      <span className="solitaire-card-back-pattern" />
      {count !== undefined && count > 1 && <span className="solitaire-card-count">{count}</span>}
    </span>
  );
}

const FLIGHT_MS = 180;
const activeFlights = new WeakMap<HTMLElement, Animation>();

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Briefly fly `el` from `from` to where it sits now (FLIP): invert the delta,
 * then let a Web Animation carry it to rest. Used when cards are moved for the
 * player (safe autoplay, double-tap, click-moves) so they don't teleport.
 */
function flyCard(el: HTMLElement, from: DOMRect, to: DOMRect, lift: boolean) {
  const dx = from.left - to.left;
  const dy = from.top - to.top;
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
  activeFlights.get(el)?.cancel();
  if (prefersReducedMotion()) {
    el.style.zIndex = '';
    return;
  }
  const shadow = 'drop-shadow(0 9px 12px rgba(15, 23, 42, 0.25))';
  const anim = el.animate(
    [
      {
        transform: `translate3d(${dx}px, ${dy}px, 0)`,
        ...(lift ? { filter: shadow } : {})
      },
      {
        transform: 'translate3d(0, 0, 0)',
        ...(lift ? { filter: 'drop-shadow(0 0 0 rgba(15, 23, 42, 0))' } : {})
      }
    ],
    { duration: FLIGHT_MS, easing: 'cubic-bezier(0.22, 0.9, 0.3, 1)' }
  );
  activeFlights.set(el, anim);
  if (lift) {
    el.style.zIndex = '50';
    anim.onfinish = () => {
      if (activeFlights.get(el) === anim) {
        activeFlights.delete(el);
        el.style.zIndex = '';
      }
    };
  }
  // If frames never tick (occluded or throttled window), the animation would
  // hold the card mid-flight forever — snap it home instead.
  window.setTimeout(() => {
    if (activeFlights.get(el) === anim) {
      anim.cancel();
      el.style.zIndex = '';
    }
  }, FLIGHT_MS + 350);
}

/** Stable per-card location key, so a diff can tell "moved" from "re-measured". */
function locationMap(solitaire: PublicSolitaire): Map<number, string> {
  const map = new Map<number, string>();
  solitaire.tableau.forEach((column, c) =>
    column.forEach((card, p) => {
      if (card >= 0) map.set(card, `t${c}:${p}`);
    })
  );
  solitaire.waste.forEach((card, i) => map.set(card, `w${i}`));
  solitaire.freeCells.forEach((card, c) => {
    if (card !== null) map.set(card, `c${c}`);
  });
  solitaire.foundations.forEach((pile, f) => pile.forEach((card, p) => map.set(card, `f${f}:${p}`)));
  return map;
}

const DRAG_THRESHOLD_PX = 5;

export function SolitaireBoard({
  solitaire,
  selected,
  disabled = false,
  onSelect,
  onMove,
  onDraw,
  onRecycle,
  onAuto,
  onCursor
}: Props) {
  const view = useMemo(() => solitaireView(solitaire), [solitaire]);
  const cursorHandlers = useCursorEmitter(onCursor, disabled);
  const selectedSlot = selected === null ? null : findCard(solitaire, selected);
  const dragRef = useRef<DragInfo | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const suppressClickRef = useRef(false);
  const suppressClickTimer = useRef<number | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const rectsRef = useRef<Map<number, { el: HTMLElement; rect: DOMRect }>>(new Map());
  const prevStateRef = useRef<PublicSolitaire | null>(null);
  const dragMoveRef = useRef<{ cards: number[]; at: number } | null>(null);
  const [drag, setDrag] = useState<DragView | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);

  // Drag handlers live on window, not on the card button: another player's
  // move can unmount the button under the pointer mid-drag, which used to
  // swallow pointerup/pointercancel and leave the ghost stuck "in hand".
  const latestRef = useRef({ onSelect, onMove });
  latestRef.current = { onSelect, onMove };
  const viewRef = useRef(view);
  viewRef.current = view;

  const endDrag = useCallback(() => {
    dragRef.current = null;
    setDrag(null);
    setHoverKey(null);
  }, []);

  // Abort a drag the moment its source is no longer the same run: someone
  // else moved/covered/swept it, the table ended, or the pointer's snapshot
  // went stale. The card must never keep following a hand it no longer owns.
  useEffect(() => {
    const info = dragRef.current;
    if (!info) return;
    if (disabled || info.roundId !== solitaire.id) {
      endDrag();
      return;
    }
    const location = locateCard(view, info.card);
    if (!location || !sameLocation(location, info.origin)) {
      endDrag();
      return;
    }
    if (!sameCards(movingCards(view, location), info.cards)) endDrag();
  }, [view, solitaire.id, disabled, endDrag]);

  // A selection is only meaningful while that card still starts a legal run
  // (or is a top card). Clear it when another player covers it or the round
  // stops accepting moves, so pressing a destination never fires a dead move.
  useEffect(() => {
    if (selected === null) return;
    if (disabled) {
      latestRef.current.onSelect(null);
      return;
    }
    const location = locateCard(view, selected);
    const cards = location ? movingCards(view, location) : [];
    if (cards.length === 0 || cards[0] !== selected) latestRef.current.onSelect(null);
  }, [view, selected, disabled]);

  // New deal: nothing from the previous table may stay picked up.
  useEffect(() => {
    endDrag();
    latestRef.current.onSelect(null);
  }, [solitaire.id, endDrag]);

  const handleWindowPointerMove = useCallback((event: PointerEvent) => {
    const info = dragRef.current;
    if (!info || event.pointerId !== info.pointerId) return;
    if (!info.active) {
      if (Math.hypot(event.clientX - info.startX, event.clientY - info.startY) < DRAG_THRESHOLD_PX) {
        return;
      }
      info.active = true;
      latestRef.current.onSelect(null);
      setDrag({
        card: info.card,
        cards: info.cards,
        x: event.clientX - info.grabX,
        y: event.clientY - info.grabY,
        grabX: info.grabX,
        grabY: info.grabY,
        step: info.step,
        cardWidth: info.cardWidth
      });
    }
    if (ghostRef.current) {
      ghostRef.current.style.transform = `translate3d(${event.clientX - info.grabX}px, ${
        event.clientY - info.grabY
      }px, 0)`;
    }
    const target = dropTargetAt(event.clientX, event.clientY);
    const valid = target !== null && canPlace(viewRef.current, info.cards, target);
    const next = valid ? `${target.zone}:${target.index}` : null;
    setHoverKey((prev) => (prev === next ? prev : next));
  }, []);

  const handleWindowPointerUp = useCallback((event: PointerEvent) => {
    const info = dragRef.current;
    if (!info || event.pointerId !== info.pointerId) return;
    const wasActive = info.active;
    const card = info.card;
    dragRef.current = null;
    if (!wasActive) return;
    setDrag(null);
    setHoverKey(null);
    suppressClickRef.current = true;
    if (suppressClickTimer.current) clearTimeout(suppressClickTimer.current);
    suppressClickTimer.current = window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
    const target = dropTargetAt(event.clientX, event.clientY);
    if (!target) return;
    const currentView = viewRef.current;
    const location = locateCard(currentView, card);
    if (!location || !sameLocation(location, info.origin)) return;
    const cards = movingCards(currentView, location);
    if (!sameCards(cards, info.cards)) return;
    if (!canPlace(currentView, cards, target)) return;
    dragMoveRef.current = { cards, at: Date.now() };
    latestRef.current.onMove(card, target);
  }, []);

  const handleWindowPointerCancel = useCallback((event: PointerEvent) => {
    const info = dragRef.current;
    if (!info || event.pointerId !== info.pointerId) return;
    dragRef.current = null;
    if (info.active) {
      setDrag(null);
      setHoverKey(null);
    }
  }, []);

  const handleWindowBlur = useCallback(() => {
    if (dragRef.current) endDrag();
  }, [endDrag]);

  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'hidden' && dragRef.current) endDrag();
  }, [endDrag]);

  useEffect(() => {
    window.addEventListener('pointermove', handleWindowPointerMove, true);
    window.addEventListener('pointerup', handleWindowPointerUp, true);
    window.addEventListener('pointercancel', handleWindowPointerCancel, true);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove, true);
      window.removeEventListener('pointerup', handleWindowPointerUp, true);
      window.removeEventListener('pointercancel', handleWindowPointerCancel, true);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      dragRef.current = null;
      if (suppressClickTimer.current) clearTimeout(suppressClickTimer.current);
    };
  }, [
    handleWindowPointerMove,
    handleWindowPointerUp,
    handleWindowPointerCancel,
    handleWindowBlur,
    handleVisibilityChange
  ]);

  // Flight pass: after each commit, diff card locations against the previous
  // state and fly whatever moved (safe autoplay, double-tap, click-moves) from
  // where it used to be. Drag drops are skipped — the ghost already carried
  // those cards to their drop point.
  useLayoutEffect(() => {
    const board = boardRef.current;
    const rects = new Map<number, { el: HTMLElement; rect: DOMRect }>();
    if (board) {
      board.querySelectorAll<HTMLElement>('[data-card]').forEach((el) => {
        const card = Number(el.dataset.card);
        if (Number.isInteger(card)) rects.set(card, { el, rect: el.getBoundingClientRect() });
      });
    }
    const prev = prevStateRef.current;
    if (prev && prev !== solitaire && prev.id === solitaire.id) {
      const justDropped = dragMoveRef.current;
      const skip = justDropped && Date.now() - justDropped.at < 600 ? new Set(justDropped.cards) : null;
      const prevLoc = locationMap(prev);
      const nextLoc = locationMap(solitaire);
      for (const [card, entry] of rects) {
        if (skip?.has(card) || drag?.cards.includes(card)) continue;
        const from = rectsRef.current.get(card);
        if (!from) continue;
        if (prevLoc.get(card) !== nextLoc.get(card)) {
          flyCard(entry.el, from.rect, entry.rect, true);
        } else if (entry.el.closest('.solitaire-waste')) {
          flyCard(entry.el, from.rect, entry.rect, false);
        }
      }
    }
    if (prev !== solitaire) dragMoveRef.current = null;
    rectsRef.current = rects;
    prevStateRef.current = solitaire;
  });

  const clickCard = (card: number, slot: DropSource) => {
    if (suppressClickRef.current) return;
    if (disabled) return;
    if (selected === card) {
      onSelect(null);
      return;
    }
    if (selected !== null) {
      if (
        slot !== 'waste' &&
        slot.zone === 'tableau' &&
        selectedSlot !== null &&
        selectedSlot !== 'waste' &&
        selectedSlot.zone === 'tableau' &&
        selectedSlot.index === slot.index
      ) {
        onSelect(card);
        return;
      }
      if (slot !== 'waste') {
        onMove(selected, slot);
        onSelect(null);
        return;
      }
    }
    onSelect(card);
  };

  const clickSlot = (slot: SolitaireSlot) => {
    if (disabled) return;
    if (selected !== null) {
      onMove(selected, slot);
      onSelect(null);
    }
  };

  const doubleClickCard = (card: number) => {
    if (disabled) return;
    onAuto(card);
    onSelect(null);
  };

  const cardPointerDown = (
    card: number,
    slot: DropSource,
    event: ReactPointerEvent<HTMLButtonElement>
  ) => {
    suppressClickRef.current = false;
    if (disabled || dragRef.current) return;
    const location = locateCard(view, card);
    if (!location) return;
    const cards = movingCards(view, location);
    if (cards.length === 0 || cards[0] !== card) return;
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      card,
      cards: [...cards],
      roundId: solitaire.id,
      origin: { ...location },
      cardWidth: rect.width,
      step: 0,
      grabX: event.clientX - rect.left,
      grabY: event.clientY - rect.top,
      startX: event.clientX,
      startY: event.clientY,
      active: false
    };
    const info = dragRef.current;
    const maxFan = info.cardWidth * 1.4 * 4;
    info.step =
      cards.length > 1 ? Math.min(info.cardWidth * 0.5, maxFan / (cards.length - 1)) : 0;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // pointer already released
    }
  };

  const dragEventsFor = (card: number, slot: DropSource): DragEvents | undefined => {
    if (disabled) return undefined;
    return {
      onPointerDown: (event) => cardPointerDown(card, slot, event)
    };
  };

  const topWaste = solitaire.waste.length > 0 ? solitaire.waste[solitaire.waste.length - 1] : null;
  const visibleWaste = solitaire.waste.slice(-3);

  return (
    <div
      ref={boardRef}
      className={`solitaire-board solitaire-board-${solitaire.variant}`}
      onPointerMove={cursorHandlers.onPointerMove}
      onPointerLeave={cursorHandlers.onPointerLeave}
    >
      <div className="solitaire-top">
        <div className="solitaire-pile-line">
          {solitaire.variant === 'klondike' ? (
            <>
              <button
                type="button"
                className={classNames(
                  'solitaire-slot solitaire-stock',
                  solitaire.stockCount === 0 && solitaire.waste.length > 0 && 'solitaire-slot-action'
                )}
                onClick={() => {
                  if (disabled) return;
                  if (solitaire.stockCount > 0) onDraw();
                  else if (solitaire.waste.length > 0) onRecycle();
                }}
                disabled={disabled || (solitaire.stockCount === 0 && solitaire.waste.length === 0)}
                aria-label={
                  solitaire.stockCount > 0
                    ? `Draw ${solitaire.draw} card${solitaire.draw === 1 ? '' : 's'}`
                    : 'Recycle the waste pile'
                }
              >
                {solitaire.stockCount > 0 ? (
                  <CardBack count={solitaire.stockCount} />
                ) : (
                  <span className="solitaire-slot-label">
                    <IconRefresh size={19} />
                    <em>Recycle</em>
                  </span>
                )}
              </button>

              <div className="solitaire-waste">
                {visibleWaste.length === 0 ? (
                  <span className="solitaire-slot solitaire-slot-empty">
                    <span className="solitaire-slot-hint">Waste</span>
                  </span>
                ) : (
                  visibleWaste.map((card, index) => {
                    const top = card === topWaste;
                    return (
                      <span
                        key={card}
                        data-card={card}
                        className="solitaire-waste-card"
                        style={{ left: `calc(${index} * var(--card-w) * 0.3)` }}
                      >
                        {top ? (
                          <PlayingCard
                            card={card}
                            selected={selected === card}
                            disabled={disabled}
                            dragging={drag?.cards.includes(card) ?? false}
                            onCardClick={() => clickCard(card, 'waste')}
                            onCardDoubleClick={() => doubleClickCard(card)}
                            dragEvents={dragEventsFor(card, 'waste')}
                          />
                        ) : (
                          <CardFace card={card} className="solitaire-card-static" />
                        )}
                      </span>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <div className="solitaire-freecells" aria-label="Free cells">
              {solitaire.freeCells.map((card, index) => (
                <div
                  className={classNames(
                    'solitaire-freecell',
                    hoverKey === `freecell:${index}` && 'solitaire-drop-ok'
                  )}
                  key={index}
                  data-drop={`freecell:${index}`}
                >
                  {card === null ? (
                    <button
                      type="button"
                      className={classNames(
                        'solitaire-slot solitaire-slot-empty',
                        selected !== null && 'solitaire-slot-action'
                      )}
                      onClick={() => clickSlot({ zone: 'freecell', index })}
                      disabled={disabled || selected === null}
                      aria-label={`Free cell ${index + 1}`}
                    >
                      <span className="solitaire-cell-mark" />
                    </button>
                  ) : (
                    <PlayingCard
                      card={card}
                      dataCard
                      selected={selected === card}
                      disabled={disabled}
                      dragging={drag?.cards.includes(card) ?? false}
                      onCardClick={() => clickCard(card, { zone: 'freecell', index })}
                      onCardDoubleClick={() => doubleClickCard(card)}
                      dragEvents={dragEventsFor(card, { zone: 'freecell', index })}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="solitaire-spacer" />

        <div className="solitaire-foundations" aria-label="Foundations">
          {solitaire.foundations.map((pile, index) => {
            const top = pile.length > 0 ? pile[pile.length - 1] : null;
            const suit = SUITS[index];
            return (
              <div
                className={classNames(
                  'solitaire-foundation',
                  hoverKey === `foundation:${index}` && 'solitaire-drop-ok'
                )}
                key={index}
                data-drop={`foundation:${index}`}
              >
                {top === null ? (
                  <button
                    type="button"
                    className={classNames(
                      'solitaire-slot solitaire-slot-empty',
                      selected !== null && 'solitaire-slot-action'
                    )}
                    onClick={() => clickSlot({ zone: 'foundation', index })}
                    disabled={disabled || selected === null}
                    aria-label={`${suit} foundation`}
                  >
                    <span className="solitaire-foundation-suit">{SUIT_SYMBOLS[suit]}</span>
                  </button>
                ) : (
                  <PlayingCard
                    card={top}
                    dataCard
                    selected={selected === top}
                    disabled={disabled}
                    dragging={drag?.cards.includes(top) ?? false}
                    onCardClick={() => clickCard(top, { zone: 'foundation', index })}
                    onCardDoubleClick={() => doubleClickCard(top)}
                    dragEvents={dragEventsFor(top, { zone: 'foundation', index })}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className={`solitaire-tableau solitaire-tableau-${solitaire.variant}`}>
        {solitaire.tableau.map((column, index) => {
          const faceDown = solitaire.faceDown[index] ?? 0;
          return (
            <div
              className={classNames(
                'solitaire-column',
                hoverKey === `tableau:${index}` && 'solitaire-drop-ok'
              )}
              key={index}
              data-drop={`tableau:${index}`}
            >
              {column.length === 0 ? (
                <button
                  type="button"
                  className={classNames(
                    'solitaire-slot solitaire-slot-empty solitaire-column-empty',
                    selected !== null && 'solitaire-slot-action'
                  )}
                  onClick={() => clickSlot({ zone: 'tableau', index })}
                  disabled={disabled || selected === null}
                  aria-label={`Tableau column ${index + 1}`}
                >
                  <span className="solitaire-slot-hint">{solitaire.variant === 'klondike' ? 'K' : '+'}</span>
                </button>
              ) : (
                column.map((card, position) => {
                  if (position < faceDown || card < 0) {
                    return (
                      <div
                        className="solitaire-card-wrap"
                        key={`down-${position}`}
                        data-card={card >= 0 ? card : undefined}
                        onClick={() => {
                          if (selected !== null) clickSlot({ zone: 'tableau', index });
                        }}
                      >
                        <CardBack />
                      </div>
                    );
                  }
                  return (
                    <div className="solitaire-card-wrap" key={card}>
                      <PlayingCard
                        card={card}
                        dataCard
                        selected={selected === card}
                        disabled={disabled}
                        dragging={drag?.cards.includes(card) ?? false}
                        onCardClick={() => clickCard(card, { zone: 'tableau', index })}
                        onCardDoubleClick={() => doubleClickCard(card)}
                        dragEvents={dragEventsFor(card, { zone: 'tableau', index })}
                      />
                    </div>
                  );
                })
              )}
            </div>
          );
        })}
      </div>

      {onCursor && <PresenceLayer />}

      {drag &&
        createPortal(
          <div
            ref={ghostRef}
            className="solitaire-drag-ghost"
            style={
              {
                '--card-w': `${drag.cardWidth}px`,
                transform: `translate3d(${drag.x}px, ${drag.y}px, 0)`
              } as CSSProperties
            }
          >
            {drag.cards.map((card, index) => (
              <CardFace
                key={card}
                card={card}
                className="solitaire-drag-ghost-card"
                style={{ top: index * drag.step }}
              />
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
