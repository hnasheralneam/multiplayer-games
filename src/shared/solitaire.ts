import {
  cardRank,
  cardSuitIndex,
  isRedCard,
  type KlondikeDraw,
  type SolitaireSlot,
  type SolitaireVariant
} from './types';

export interface SolitaireState {
  variant: SolitaireVariant;
  draw: KlondikeDraw;
  stock: number[];
  waste: number[];
  foundations: number[][];
  tableau: number[][];
  faceDown: number[];
  freeCells: Array<number | null>;
  passes: number;
}

interface CardLocation {
  zone: 'tableau' | 'waste' | 'foundation' | 'freecell';
  index: number;
  position: number;
}

export function topCard(pile: number[]): number | null {
  return pile.length > 0 ? pile[pile.length - 1] : null;
}

export function isDescendingAlternating(cards: number[]): boolean {
  for (let i = 1; i < cards.length; i += 1) {
    const above = cards[i - 1];
    const below = cards[i];
    if (cardRank(above) !== cardRank(below) + 1) return false;
    if (isRedCard(above) === isRedCard(below)) return false;
  }
  return true;
}

export function locateCard(state: SolitaireState, card: number): CardLocation | null {
  for (let index = 0; index < state.tableau.length; index += 1) {
    const position = state.tableau[index].lastIndexOf(card);
    if (position >= 0) return { zone: 'tableau', index, position };
  }
  if (state.waste.length > 0 && state.waste[state.waste.length - 1] === card) {
    return { zone: 'waste', index: 0, position: state.waste.length - 1 };
  }
  for (let index = 0; index < state.freeCells.length; index += 1) {
    if (state.freeCells[index] === card) {
      return { zone: 'freecell', index, position: 0 };
    }
  }
  for (let index = 0; index < state.foundations.length; index += 1) {
    const pile = state.foundations[index];
    if (pile.length > 0 && pile[pile.length - 1] === card) {
      return { zone: 'foundation', index, position: pile.length - 1 };
    }
  }
  return null;
}

export function movingCards(state: SolitaireState, location: CardLocation): number[] {
  switch (location.zone) {
    case 'tableau': {
      if (location.position < state.faceDown[location.index]) return [];
      const cards = state.tableau[location.index].slice(location.position);
      if (!isDescendingAlternating(cards)) return [];
      return cards;
    }
    case 'waste':
      return [state.waste[state.waste.length - 1]];
    case 'freecell': {
      const card = state.freeCells[location.index];
      return card === null || card === undefined ? [] : [card];
    }
    case 'foundation': {
      const pile = state.foundations[location.index];
      return pile.length > 0 ? [pile[pile.length - 1]] : [];
    }
  }
}

export function freeCellCapacity(state: SolitaireState, destination: number): number {
  const freeCells = state.freeCells.filter((card) => card === null).length;
  const emptyColumns = state.tableau.filter(
    (column, index) => column.length === 0 && index !== destination
  ).length;
  return (freeCells + 1) * (emptyColumns + 1);
}

export function canPlace(state: SolitaireState, cards: number[], target: SolitaireSlot): boolean {
  if (cards.length === 0) return false;
  if (target.zone === 'foundation') {
    if (target.index < 0 || target.index > 3 || cards.length !== 1) return false;
    const card = cards[0];
    if (cardSuitIndex(card) !== target.index) return false;
    const pile = state.foundations[target.index];
    const top = topCard(pile);
    return top === null ? cardRank(card) === 1 : cardRank(card) === cardRank(top) + 1;
  }

  if (target.zone === 'freecell') {
    if (state.variant !== 'freecell') return false;
    if (target.index < 0 || target.index > 3 || cards.length !== 1) return false;
    return state.freeCells[target.index] === null;
  }

  if (target.index < 0 || target.index >= state.tableau.length) return false;
  if (state.variant === 'freecell' && cards.length > freeCellCapacity(state, target.index)) {
    return false;
  }
  const column = state.tableau[target.index];
  const top = topCard(column);
  if (top === null) {
    return state.variant === 'freecell' || cardRank(cards[0]) === 13;
  }
  return cardRank(cards[0]) === cardRank(top) - 1 && isRedCard(cards[0]) !== isRedCard(top);
}

export function removeCards(state: SolitaireState, location: CardLocation, cards: number[]): void {
  switch (location.zone) {
    case 'tableau': {
      state.tableau[location.index].splice(location.position, cards.length);
      const remaining = state.tableau[location.index];
      if (remaining.length === 0) {
        state.faceDown[location.index] = 0;
      } else if (state.faceDown[location.index] >= remaining.length) {
        state.faceDown[location.index] = Math.max(0, remaining.length - 1);
      }
      return;
    }
    case 'waste':
      state.waste.pop();
      return;
    case 'freecell':
      state.freeCells[location.index] = null;
      return;
    case 'foundation':
      state.foundations[location.index].pop();
  }
}

export function appendCards(state: SolitaireState, cards: number[], target: SolitaireSlot): void {
  if (target.zone === 'tableau') {
    state.tableau[target.index].push(...cards);
  } else if (target.zone === 'foundation') {
    state.foundations[target.index].push(cards[0]);
  } else if (state.variant === 'freecell') {
    state.freeCells[target.index] = cards[0];
  }
}

export function playMove(state: SolitaireState, card: number, target: SolitaireSlot): boolean {
  const location = locateCard(state, card);
  if (!location) return false;
  const cards = movingCards(state, location);
  if (cards.length === 0) return false;
  if (!canPlace(state, cards, target)) return false;
  removeCards(state, location, cards);
  appendCards(state, cards, target);
  return true;
}

export function canAutoMove(state: SolitaireState, card: number): boolean {
  const location = locateCard(state, card);
  if (!location) return false;
  const cards = movingCards(state, location);
  if (cards.length !== 1) return false;
  const foundation = cardSuitIndex(card);
  return canPlace(state, cards, { zone: 'foundation', index: foundation });
}

export function autoMove(state: SolitaireState, card: number): boolean {
  if (!canAutoMove(state, card)) return false;
  return playMove(state, card, { zone: 'foundation', index: cardSuitIndex(card) });
}

function foundationRank(state: SolitaireState, suitIndex: number): number {
  const top = topCard(state.foundations[suitIndex] ?? []);
  return top === null ? 0 : cardRank(top);
}

/**
 * Standard "safe autoplay" rule: aces and twos always fly up; a higher card
 * only when both opposite-color foundations have reached rank r-1 (so no
 * opposite-color r-1 card can still need it as a landing spot) and the other
 * same-color foundation has reached rank r-2.
 */
export function isSafeAutoMove(state: SolitaireState, card: number): boolean {
  if (!canAutoMove(state, card)) return false;
  const rank = cardRank(card);
  if (rank <= 2) return true;
  const suitIndex = cardSuitIndex(card);
  const cardIsRed = isRedCard(card);
  for (let suit = 0; suit < 4; suit += 1) {
    if (suit === suitIndex) continue;
    const sameColor = isRedCard(suit * 13) === cardIsRed;
    const required = sameColor ? rank - 2 : rank - 1;
    if (foundationRank(state, suit) < required) return false;
  }
  return true;
}

/**
 * Play every safe card to its foundation, repeating until nothing moves.
 * Returns true when at least one card was played.
 */
export function autoPlaySafe(state: SolitaireState): boolean {
  let moved = false;
  let swept = true;
  while (swept) {
    swept = false;
    const candidates: number[] = [];
    for (const column of state.tableau) {
      const top = topCard(column);
      if (top !== null) candidates.push(top);
    }
    for (const cell of state.freeCells) {
      if (cell !== null) candidates.push(cell);
    }
    const wasteTop = topCard(state.waste);
    if (wasteTop !== null) candidates.push(wasteTop);
    for (const card of candidates) {
      if (isSafeAutoMove(state, card) && autoMove(state, card)) {
        moved = true;
        swept = true;
        break;
      }
    }
  }
  return moved;
}

export function drawStock(state: SolitaireState): boolean {
  if (state.variant !== 'klondike' || state.stock.length === 0) return false;
  const count = Math.min(state.draw, state.stock.length);
  for (let i = 0; i < count; i += 1) {
    state.waste.push(state.stock.pop() as number);
  }
  return true;
}

export function recycleWaste(state: SolitaireState): boolean {
  if (state.variant !== 'klondike' || state.stock.length > 0 || state.waste.length === 0) {
    return false;
  }
  while (state.waste.length > 0) {
    state.stock.push(state.waste.pop() as number);
  }
  state.passes += 1;
  return true;
}

export function solitaireWon(state: SolitaireState): boolean {
  return state.foundations.every((pile) => pile.length === 13);
}

export function foundationTotal(state: SolitaireState): number {
  return state.foundations.reduce((total, pile) => total + pile.length, 0);
}
