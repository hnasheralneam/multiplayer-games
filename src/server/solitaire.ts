import type { KlondikeDraw, SolitaireVariant } from '../shared/types';
import { type SolitaireState } from '../shared/solitaire';
import { mulberry32 } from './board';

export {
  type SolitaireState,
  topCard,
  isDescendingAlternating,
  locateCard,
  movingCards,
  freeCellCapacity,
  canPlace,
  removeCards,
  appendCards,
  playMove,
  canAutoMove,
  autoMove,
  isSafeAutoMove,
  autoPlaySafe,
  drawStock,
  recycleWaste,
  solitaireWon,
  foundationTotal
} from '../shared/solitaire';

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
