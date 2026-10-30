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
import { classNames } from '../lib/format';
import { IconRefresh } from './icons';

interface Props {
  solitaire: PublicSolitaire;
  selected: number | null;
  disabled?: boolean;
  onSelect: (card: number | null) => void;
  onMove: (card: number, to: SolitaireSlot) => void;
  onDraw: () => void;
  onRecycle: () => void;
  onAuto: (card: number) => void;
}

function findCard(solitaire: PublicSolitaire, card: number): SolitaireSlot | 'waste' | null {
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

function PlayingCard({
  card,
  selected,
  disabled,
  onCardClick,
  onCardDoubleClick
}: {
  card: number;
  selected: boolean;
  disabled: boolean;
  onCardClick: () => void;
  onCardDoubleClick: () => void;
}) {
  const red = isRedCard(card);
  const suit = cardSuit(card);
  const rank = RANK_LABELS[cardRank(card)];
  return (
    <button
      type="button"
      className={classNames(
        'solitaire-card',
        red ? 'solitaire-card-red' : 'solitaire-card-black',
        selected && 'solitaire-card-selected'
      )}
      onClick={(event) => {
        event.stopPropagation();
        onCardClick();
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onCardDoubleClick();
      }}
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

export function SolitaireBoard({
  solitaire,
  selected,
  disabled = false,
  onSelect,
  onMove,
  onDraw,
  onRecycle,
  onAuto
}: Props) {
  const selectedSlot = selected === null ? null : findCard(solitaire, selected);

  const clickCard = (card: number, slot: SolitaireSlot | 'waste') => {
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

  const topWaste = solitaire.waste.length > 0 ? solitaire.waste[solitaire.waste.length - 1] : null;
  const visibleWaste = solitaire.waste.slice(-3);

  return (
    <div className={`solitaire-board solitaire-board-${solitaire.variant}`}>
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
                        className="solitaire-waste-card"
                        style={{ left: `calc(${index} * var(--card-w) * 0.3)` }}
                      >
                        {top ? (
                          <PlayingCard
                            card={card}
                            selected={selected === card}
                            disabled={disabled}
                            onCardClick={() => clickCard(card, 'waste')}
                            onCardDoubleClick={() => doubleClickCard(card)}
                          />
                        ) : (
                          <span className="solitaire-card solitaire-card-static" aria-hidden="true">
                            <span className="solitaire-card-corner">
                              <strong>{RANK_LABELS[cardRank(card)]}</strong>
                              <span>{SUIT_SYMBOLS[cardSuit(card)]}</span>
                            </span>
                          </span>
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
                <div className="solitaire-freecell" key={index}>
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
                      selected={selected === card}
                      disabled={disabled}
                      onCardClick={() => clickCard(card, { zone: 'freecell', index })}
                      onCardDoubleClick={() => doubleClickCard(card)}
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
              <div className="solitaire-foundation" key={index}>
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
                    selected={selected === top}
                    disabled={disabled}
                    onCardClick={() => clickCard(top, { zone: 'foundation', index })}
                    onCardDoubleClick={() => doubleClickCard(top)}
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
            <div className="solitaire-column" key={index}>
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
                        selected={selected === card}
                        disabled={disabled}
                        onCardClick={() => clickCard(card, { zone: 'tableau', index })}
                        onCardDoubleClick={() => doubleClickCard(card)}
                      />
                    </div>
                  );
                })
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
