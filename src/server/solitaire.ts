import {
  cardRank,
  cardSuitIndex,
  isRedCard,
  type KlondikeDraw,
  type SolitaireSlot,
  type SolitaireVariant
} from '../shared/types';
import { mulberry32 } from './board';

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

function shuffledDeck(seed: number): number[] {
  const deck = Array.from({ length: 52 }, (_, index) => index);
  const random = mulberry32(seed);
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function emptyFoundations(): number[][] {
  return [[], [], [], []];
}

function dealKlondike(deck: number[], draw: KlondikeDraw): SolitaireState {
  const tableau: number[][] = Array.from({ length: 7 }, () => []);
  const faceDown: number[] = Array.from({ length: 7 }, () => 0);
  for (let column = 0; column < 7; column += 1) {
    for (let row = 0; row <= column; row += 1) {
      tableau[column].push(deck.pop() as number);
    }
    faceDown[column] = column;
  }
  return {
    variant: 'klondike',
    draw,
    stock: deck,
    waste: [],
    foundations: emptyFoundations(),
    tableau,
    faceDown,
    freeCells: [],
    passes: 0
  };
}

function dealFreeCell(deck: number[]): SolitaireState {
  const tableau: number[][] = Array.from({ length: 8 }, () => []);
  for (let i = 0; i < deck.length; i += 1) {
    tableau[i % 8].push(deck[i]);
  }
  return {
    variant: 'freecell',
    draw: 1,
    stock: [],
    waste: [],
    foundations: emptyFoundations(),
    tableau,
    faceDown: Array.from({ length: 8 }, () => 0),
    freeCells: [null, null, null, null],
    passes: 0
  };
}

export function dealSolitaire(
  variant: SolitaireVariant,
  seed: number,
  draw: KlondikeDraw = 1
): SolitaireState {
  const deck = shuffledDeck(seed);
  return variant === 'klondike' ? dealKlondike(deck, draw) : dealFreeCell(deck);
}

function topCard(pile: number[]): number | null {
  return pile.length > 0 ? pile[pile.length - 1] : null;
}

function isDescendingAlternating(cards: number[]): boolean {
  for (let i = 1; i < cards.length; i += 1) {
    const above = cards[i - 1];
    const below = cards[i];
    if (cardRank(above) !== cardRank(below) + 1) return false;
    if (isRedCard(above) === isRedCard(below)) return false;
  }
  return true;
}

function locateCard(state: SolitaireState, card: number): CardLocation | null {
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

function movingCards(state: SolitaireState, location: CardLocation): number[] {
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

function freeCellCapacity(state: SolitaireState, destination: number): number {
  const freeCells = state.freeCells.filter((card) => card === null).length;
  const emptyColumns = state.tableau.filter(
    (column, index) => column.length === 0 && index !== destination
  ).length;
  return (freeCells + 1) * (emptyColumns + 1);
}

function canPlace(state: SolitaireState, cards: number[], target: SolitaireSlot): boolean {
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

function removeCards(
  state: SolitaireState,
  location: CardLocation,
  cards: number[]
): void {
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

function appendCards(state: SolitaireState, cards: number[], target: SolitaireSlot): void {
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
