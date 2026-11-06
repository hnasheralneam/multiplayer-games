import {
  autoPlaySafe,
  canPlace,
  drawStock,
  foundationTotal,
  isDescendingAlternating,
  isSafeAutoMove,
  playMove,
  recycleWaste,
  solitaireWon,
  type SolitaireState
} from '../../shared/solitaire';
import { cardSuitIndex, type SolitaireSlot } from '../../shared/types';

export type SolveVerdict = 'solvable' | 'unsolvable' | 'unknown';

export interface SolveOptions {
  /** Wall-clock budget in milliseconds. Default 5000. */
  budgetMs?: number;
  /** Maximum number of explored positions. Default 400000. */
  maxNodes?: number;
}

interface SolverMove {
  card?: number;
  to?: SolitaireSlot;
  action?: 'draw' | 'recycle';
}

function cloneState(state: SolitaireState): SolitaireState {
  return {
    variant: state.variant,
    draw: state.draw,
    stock: state.stock.slice(),
    waste: state.waste.slice(),
    foundations: state.foundations.map((pile) => pile.slice()),
    tableau: state.tableau.map((column) => column.slice()),
    faceDown: state.faceDown.slice(),
    freeCells: state.freeCells.slice(),
    passes: state.passes
  };
}

/**
 * Transposition key. Free cells are interchangeable so they are sorted;
 * pass counts are irrelevant (passes are unlimited) and merged.
 */
function stateKey(state: SolitaireState): string {
  const foundations = state.foundations.map((pile) => pile.length).join(',');
  const columns = state.tableau.map((column) => column.join('.')).join(';');
  if (state.variant === 'freecell') {
    const cells = state.freeCells
      .filter((card): card is number => card !== null)
      .sort((a, b) => a - b)
      .join(',');
    return `f${foundations}|c${cells}|t${columns}`;
  }
  const stock = state.stock.join('.');
  const waste = state.waste.join('.');
  const faceDown = state.faceDown.join(',');
  return `f${foundations}|t${columns}|d${faceDown}|s${stock}|w${waste}`;
}

function firstEmptyCell(state: SolitaireState): number {
  return state.freeCells.indexOf(null);
}

/**
 * All legal moves in priority order: foundation plays, revealing tableau
 * moves, other tableau moves (including foundation pull-backs in Klondike),
 * free-cell parking, then draw/recycle.
 */
function generateMoves(state: SolitaireState): SolverMove[] {
  const foundationMoves: SolverMove[] = [];
  const revealMoves: SolverMove[] = [];
  const tableauMoves: SolverMove[] = [];
  const pullMoves: SolverMove[] = [];
  const parkingMoves: SolverMove[] = [];
  const stockMoves: SolverMove[] = [];

  const tryFoundation = (card: number) => {
    const to: SolitaireSlot = { zone: 'foundation', index: cardSuitIndex(card) };
    if (canPlace(state, [card], to)) foundationMoves.push({ card, to });
  };

  if (state.variant === 'klondike') {
    const wasteTop = state.waste[state.waste.length - 1];
    if (wasteTop !== undefined) {
      tryFoundation(wasteTop);
      for (let j = 0; j < state.tableau.length; j += 1) {
        const to: SolitaireSlot = { zone: 'tableau', index: j };
        if (canPlace(state, [wasteTop], to)) tableauMoves.push({ card: wasteTop, to });
      }
    }
  } else {
    for (const card of state.freeCells) {
      if (card === null) continue;
      tryFoundation(card);
      for (let j = 0; j < state.tableau.length; j += 1) {
        const to: SolitaireSlot = { zone: 'tableau', index: j };
        if (canPlace(state, [card], to)) tableauMoves.push({ card, to });
      }
    }
  }

  for (let i = 0; i < state.tableau.length; i += 1) {
    const column = state.tableau[i];
    const faceDownCount = state.faceDown[i] ?? 0;
    const top = column.length > 0 ? column[column.length - 1] : null;
    if (top !== null) tryFoundation(top);

    for (let position = column.length - 1; position >= faceDownCount; position -= 1) {
      const run = column.slice(position);
      if (position < column.length - 1 && !isDescendingAlternating(run)) break;
      for (let j = 0; j < state.tableau.length; j += 1) {
        if (j === i) continue;
        // Moving a whole column onto an empty column only relabels columns.
        if (position === 0 && state.tableau[j].length === 0) continue;
        const to: SolitaireSlot = { zone: 'tableau', index: j };
        if (canPlace(state, run, to)) {
          const move: SolverMove = { card: run[0], to };
          if (position === faceDownCount && faceDownCount > 0) revealMoves.push(move);
          else tableauMoves.push(move);
        }
      }
    }

    if (state.variant === 'freecell' && top !== null && firstEmptyCell(state) >= 0) {
      parkingMoves.push({ card: top, to: { zone: 'freecell', index: -1 } });
    }
  }

  // In FreeCell a foundation card never needs to come back down (known
  // theorem); in Klondike it occasionally does. A safe card would be swept
  // straight back up by the forced autoplay, so only unsafe tops can
  // meaningfully be pulled.
  if (state.variant === 'klondike') {
    for (let suit = 0; suit < 4; suit += 1) {
      const pile = state.foundations[suit];
      const top = pile.length > 0 ? pile[pile.length - 1] : null;
      if (top === null || isSafeAutoMove(state, top)) continue;
      for (let j = 0; j < state.tableau.length; j += 1) {
        const to: SolitaireSlot = { zone: 'tableau', index: j };
        if (canPlace(state, [top], to)) pullMoves.push({ card: top, to });
      }
    }
  }

  if (state.variant === 'klondike') {
    if (state.stock.length > 0) stockMoves.push({ action: 'draw' });
    else if (state.waste.length > 0) stockMoves.push({ action: 'recycle' });
  }

  return [
    ...foundationMoves,
    ...revealMoves,
    ...tableauMoves,
    ...pullMoves,
    ...parkingMoves,
    ...stockMoves
  ];
}

function applyMove(state: SolitaireState, move: SolverMove): boolean {
  if (move.action === 'draw') return drawStock(state);
  if (move.action === 'recycle') return recycleWaste(state);
  if (move.card === undefined || !move.to) return false;
  let to = move.to;
  if (to.zone === 'freecell' && to.index < 0) {
    const cell = firstEmptyCell(state);
    if (cell < 0) return false;
    to = { zone: 'freecell', index: cell };
  }
  return playMove(state, move.card, to);
}

interface SearchContext {
  deadline: number;
  maxNodes: number;
  visited: Set<string>;
  cutShort: boolean;
}

function makeContext(budgetMs: number, maxNodes: number): SearchContext {
  return { deadline: Date.now() + budgetMs, maxNodes, visited: new Set(), cutShort: false };
}

function outOfBudget(ctx: SearchContext, expanded: number): boolean {
  return Date.now() > ctx.deadline || expanded > ctx.maxNodes;
}

/**
 * Greedy best-first search. FreeCell's winning lines are wide and shallow,
 * so prioritizing "fewest cards not home" finds them quickly. Draining the
 * queue proves unsolvability; hitting the budget yields 'unknown'.
 */
function searchBestFirst(state: SolitaireState, ctx: SearchContext): SolveVerdict {
  let expanded = 0;

  interface Entry {
    parentState: SolitaireState;
    isRoot: boolean;
    move: SolverMove;
    priority: number;
    depth: number;
  }
  const heap: Entry[] = [];
  const push = (entry: Entry) => {
    heap.push(entry);
    let i = heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (heap[parent].priority <= heap[i].priority) break;
      [heap[parent], heap[i]] = [heap[i], heap[parent]];
      i = parent;
    }
  };
  const pop = (): Entry | undefined => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length > 0 && last !== undefined) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const left = i * 2 + 1;
        const right = left + 1;
        let smallest = i;
        if (left < heap.length && heap[left].priority < heap[smallest].priority) smallest = left;
        if (right < heap.length && heap[right].priority < heap[smallest].priority) smallest = right;
        if (smallest === i) break;
        [heap[smallest], heap[i]] = [heap[i], heap[smallest]];
        i = smallest;
      }
    }
    return top;
  };

  const root = cloneState(state);
  if (solitaireWon(root)) return 'solvable';
  push({
    parentState: root,
    isRoot: true,
    move: { action: 'draw' }, // never applied for the root entry
    priority: 52 - foundationTotal(root),
    depth: 0
  });

  while (heap.length > 0) {
    const entry = pop();
    if (entry === undefined) break;
    const current = cloneState(entry.parentState);
    if (!entry.isRoot) {
      if (!applyMove(current, entry.move)) continue;
      autoPlaySafe(current);
      if (solitaireWon(current)) return 'solvable';
    }

    const key = stateKey(current);
    if (ctx.visited.has(key)) continue;
    ctx.visited.add(key);
    expanded += 1;
    if (expanded % 256 === 0 && outOfBudget(ctx, expanded)) {
      ctx.cutShort = true;
      break;
    }

    const cardsNotHome = 52 - foundationTotal(current);
    for (const move of generateMoves(current)) {
      const gained = move.to?.zone === 'foundation' ? 1 : 0;
      push({
        parentState: current,
        isRoot: false,
        move,
        priority: cardsNotHome - gained,
        depth: entry.depth + 1
      });
    }
  }

  return ctx.cutShort ? 'unknown' : 'unsolvable';
}

/**
 * Depth-first search with legal-move ordering (foundations, revealing
 * moves, stock last). Klondike wins are long narrow sequences, so
 * committing deeply finds them far faster than best-first; the
 * transposition set keeps it complete and makes immediate move-undoing
 * cycles free. The budget aborts via exception — returning a value would
 * only prune one node and let the rest of the tree keep diving.
 *
 * Unlike the FreeCell engine this works on ONE mutable working state with
 * apply/undo (no per-child clones): face-down cards are stored negative,
 * foundations as per-suit rank counters, and every move records how to
 * reverse itself, including the forced safe-autoplay sweep.
 */
const BUDGET_ABORT = Symbol('budget-abort');

interface UndoState {
  /** Face-down cards stored as -(card + 1). */
  tableau: number[][];
  foundationRank: number[];
  stock: number[];
  waste: number[];
  passes: number;
  drawCount: number;
}

type UndoRecord = (() => void) | null;

function toUndoState(state: SolitaireState): UndoState {
  return {
    tableau: state.tableau.map((column, index) =>
      column.map((card, position) =>
        position < (state.faceDown[index] ?? 0) ? -1 - card : card
      )
    ),
    foundationRank: state.foundations.map((pile) => pile.length),
    stock: state.stock.slice(),
    waste: state.waste.slice(),
    passes: state.passes,
    drawCount: state.draw
  };
}

function undoRealCard(card: number): number {
  return card < 0 ? -1 - card : card;
}

function undoCardRank(card: number): number {
  return (undoRealCard(card) % 13) + 1;
}

function undoCardSuit(card: number): number {
  return Math.floor(undoRealCard(card) / 13);
}

function undoIsRed(card: number): boolean {
  const suit = undoCardSuit(card);
  return suit === 1 || suit === 2;
}

/** Card's rank minus the foundation top: can this card fly home right now? */
function canGoHome(work: UndoState, card: number): boolean {
  const rank = undoCardRank(card);
  return work.foundationRank[undoCardSuit(card)] === rank - 1;
}

function undoSafe(work: UndoState, card: number): boolean {
  const rank = undoCardRank(card);
  if (rank <= 2) return true;
  const suit = undoCardSuit(card);
  const isRed = undoIsRed(card);
  for (let other = 0; other < 4; other += 1) {
    if (other === suit) continue;
    const sameColor = (other === 1 || other === 2) === isRed;
    if (work.foundationRank[other] < (sameColor ? rank - 2 : rank - 1)) return false;
  }
  return true;
}

/**
 * Plays every safe card home, recording raw restore closures. The sweep is
 * deterministic, so restoring in reverse exactly reproduces the prior state.
 */
function sweepSafe(work: UndoState): UndoRecord[] {
  const records: UndoRecord[] = [];
  let swept = true;
  while (swept) {
    swept = false;
    let played = false;
    for (const column of work.tableau) {
      const top = column.length > 0 ? column[column.length - 1] : null;
      if (top === null || top < 0 || !canGoHome(work, top) || !undoSafe(work, top)) continue;
      column.pop();
      work.foundationRank[undoCardSuit(top)] += 1;
      const target = undoCardSuit(top);
      records.push(() => {
        work.foundationRank[target] -= 1;
        column.push(top);
      });
      played = true;
      break;
    }
    if (!played) {
      const top = work.waste.length > 0 ? work.waste[work.waste.length - 1] : null;
      if (top !== null && canGoHome(work, top) && undoSafe(work, top)) {
        work.waste.pop();
        work.foundationRank[undoCardSuit(top)] += 1;
        const target = undoCardSuit(top);
        records.push(() => {
          work.foundationRank[target] -= 1;
          work.waste.push(top);
        });
        played = true;
      }
    }
    swept = played;
  }
  return records;
}

function undoSweep(work: UndoState, records: UndoRecord[]): void {
  for (let i = records.length - 1; i >= 0; i -= 1) records[i]?.();
}

function faceUpStart(column: number[]): number {
  let start = 0;
  while (start < column.length && column[start] < 0) start += 1;
  return start;
}

function isUndoRun(cards: number[]): boolean {
  for (let i = 1; i < cards.length; i += 1) {
    if (undoCardRank(cards[i - 1]) !== undoCardRank(cards[i]) + 1) return false;
    if (undoIsRed(cards[i - 1]) === undoIsRed(cards[i])) return false;
  }
  return true;
}

function undoKey(work: UndoState): string {
  const columns = work.tableau.map((column) => column.join('.')).join(';');
  // Passes are excluded: recycling is unlimited, so positions differing
  // only in pass count are equivalent and must share a transposition key.
  return `${work.foundationRank.join(',')}|${columns}|${work.stock.join('.')}|${work.waste.join('.')}`;
}

type UndoMove =
  | { kind: 'tableau'; from: number; to: number; position: number }
  | { kind: 'waste-tableau'; to: number }
  | { kind: 'waste-foundation' }
  | { kind: 'tableau-foundation'; from: number }
  | { kind: 'foundation-tableau'; suit: number; to: number }
  | { kind: 'draw' }
  | { kind: 'recycle' };

/**
 * Applies a move to the working state and returns its undo closure, or
 * null when the move is illegal. Move shapes: [source, position, target]
 * for tableau runs, plus dedicated forms for waste/cell/foundation/draw.
 */
function applyUndoMove(
  work: UndoState,
  move: UndoMove
): UndoRecord {
  switch (move.kind) {
    case 'tableau': {
      const source = work.tableau[move.from];
      const target = work.tableau[move.to];
      const start = faceUpStart(source);
      if (move.position < start) return null;
      const run = source.slice(move.position);
      if (!isUndoRun(run)) return null;
      if (target.length === 0) {
        if (undoCardRank(run[0]) !== 13) return null;
      } else {
        const top = target[target.length - 1];
        if (undoCardRank(run[0]) !== undoCardRank(top) - 1) return null;
        if (undoIsRed(run[0]) === undoIsRed(top)) return null;
      }
      source.splice(move.position, run.length);
      const flipped = source.length > 0 && source[source.length - 1] < 0;
      if (flipped) {
        source[source.length - 1] = -1 - source[source.length - 1];
      }
      target.push(...run);
      return () => {
        target.length -= run.length;
        if (flipped) {
          source[source.length - 1] = -1 - source[source.length - 1];
        }
        source.splice(move.position, 0, ...run);
      };
    }
    case 'waste-tableau': {
      const card = work.waste[work.waste.length - 1];
      if (card === undefined) return null;
      const target = work.tableau[move.to];
      if (target.length === 0) {
        if (undoCardRank(card) !== 13) return null;
      } else {
        const top = target[target.length - 1];
        if (undoCardRank(card) !== undoCardRank(top) - 1) return null;
        if (undoIsRed(card) === undoIsRed(top)) return null;
      }
      work.waste.pop();
      target.push(card);
      return () => {
        target.pop();
        work.waste.push(card);
      };
    }
    case 'waste-foundation': {
      const card = work.waste[work.waste.length - 1];
      if (card === undefined || !canGoHome(work, card)) return null;
      work.waste.pop();
      work.foundationRank[undoCardSuit(card)] += 1;
      return () => {
        work.foundationRank[undoCardSuit(card)] -= 1;
        work.waste.push(card);
      };
    }
    case 'tableau-foundation': {
      const column = work.tableau[move.from];
      const card = column.length > 0 ? column[column.length - 1] : null;
      if (card === null || card < 0 || !canGoHome(work, card)) return null;
      column.pop();
      work.foundationRank[undoCardSuit(card)] += 1;
      return () => {
        work.foundationRank[undoCardSuit(card)] -= 1;
        column.push(card);
      };
    }
    case 'foundation-tableau': {
      const suit = move.suit;
      const rank = work.foundationRank[suit];
      if (rank === 0) return null;
      const card = suit * 13 + rank - 1;
      if (undoSafe(work, card)) return null; // a safe pull would be swept straight back
      const target = work.tableau[move.to];
      if (target.length === 0) {
        if (rank !== 13) return null;
      } else {
        const top = target[target.length - 1];
        if (undoCardRank(card) !== undoCardRank(top) - 1) return null;
        if (undoIsRed(card) === undoIsRed(top)) return null;
      }
      work.foundationRank[suit] -= 1;
      target.push(card);
      return () => {
        target.pop();
        work.foundationRank[suit] += 1;
      };
    }
    case 'draw': {
      if (work.stock.length === 0) return null;
      const count = Math.min(work.drawCount, work.stock.length);
      for (let i = 0; i < count; i += 1) {
        work.waste.push(work.stock.pop() as number);
      }
      // The last-drawn card sits on top of the waste; popping the waste and
      // pushing the stock restores the exact original stock order.
      return () => {
        for (let i = 0; i < count; i += 1) {
          work.stock.push(work.waste.pop() as number);
        }
      };
    }
    case 'recycle': {
      if (work.stock.length > 0 || work.waste.length === 0) return null;
      const order: number[] = [];
      while (work.waste.length > 0) {
        const card = work.waste.pop() as number;
        order.push(card);
        work.stock.push(card);
      }
      work.passes += 1;
      return () => {
        work.passes -= 1;
        while (order.length > 0) {
          const card = order.pop() as number;
          work.stock.pop();
          work.waste.push(card);
        }
      };
    }
  }
}

function generateUndoMoves(work: UndoState): UndoMove[] {
  const moves: UndoMove[] = [];

  // Foundation plays first (waste top, then column tops).
  const wasteTop = work.waste.length > 0 ? work.waste[work.waste.length - 1] : null;
  if (wasteTop !== null && canGoHome(work, wasteTop)) {
    moves.push({ kind: 'waste-foundation' });
  }
  for (let i = 0; i < work.tableau.length; i += 1) {
    const column = work.tableau[i];
    const top = column.length > 0 ? column[column.length - 1] : null;
    if (top !== null && top >= 0 && canGoHome(work, top)) {
      moves.push({ kind: 'tableau-foundation', from: i });
    }
  }

  // Revealing tableau moves, then the rest.
  const revealMoves: UndoMove[] = [];
  const plainMoves: UndoMove[] = [];
  for (let i = 0; i < work.tableau.length; i += 1) {
    const source = work.tableau[i];
    const start = faceUpStart(source);
    for (let position = source.length - 1; position >= start; position -= 1) {
      const run = source.slice(position);
      if (position < source.length - 1 && !isUndoRun(run)) break;
      for (let j = 0; j < work.tableau.length; j += 1) {
        if (j === i) continue;
        // Whole face-up column onto an empty column only relabels columns.
        if (position === 0 && work.tableau[j].length === 0) continue;
        const target = work.tableau[j];
        const legal =
          target.length === 0
            ? undoCardRank(run[0]) === 13
            : undoCardRank(run[0]) === undoCardRank(target[target.length - 1]) - 1 &&
              undoIsRed(run[0]) !== undoIsRed(target[target.length - 1]);
        if (!legal) continue;
        const move: UndoMove = { kind: 'tableau', from: i, to: j, position };
        if (position === start && start > 0) revealMoves.push(move);
        else plainMoves.push(move);
      }
    }
  }
  moves.push(...revealMoves);

  if (wasteTop !== null) {
    for (let j = 0; j < work.tableau.length; j += 1) {
      const target = work.tableau[j];
      const legal =
        target.length === 0
          ? undoCardRank(wasteTop) === 13
          : undoCardRank(wasteTop) === undoCardRank(target[target.length - 1]) - 1 &&
            undoIsRed(wasteTop) !== undoIsRed(target[target.length - 1]);
      if (legal) moves.push({ kind: 'waste-tableau', to: j });
    }
  }

  moves.push(...plainMoves);

  // Unsafe foundation pulls.
  for (let suit = 0; suit < 4; suit += 1) {
    const rank = work.foundationRank[suit];
    if (rank === 0) continue;
    const card = suit * 13 + rank - 1;
    if (undoSafe(work, card)) continue;
    for (let j = 0; j < work.tableau.length; j += 1) {
      const target = work.tableau[j];
      const legal =
        target.length === 0
          ? rank === 13
          : undoCardRank(card) === undoCardRank(target[target.length - 1]) - 1 &&
            undoIsRed(card) !== undoIsRed(target[target.length - 1]);
      if (legal) moves.push({ kind: 'foundation-tableau', suit, to: j });
    }
  }

  if (work.stock.length > 0) moves.push({ kind: 'draw' });
  else if (work.waste.length > 0) moves.push({ kind: 'recycle' });
  return moves;
}

function searchDfs(
  state: SolitaireState,
  ctx: SearchContext,
  maxDepth: number
): SolveVerdict {
  let calls = 0;

  const work = toUndoState(state);
  if (work.foundationRank.reduce((sum, rank) => sum + rank, 0) === 52) return 'solvable';

  const search = (depth: number): boolean => {
    calls += 1;
    if (calls % 256 === 0 && outOfBudget(ctx, calls)) throw BUDGET_ABORT;
    const key = undoKey(work);
    if (ctx.visited.has(key)) return false;
    ctx.visited.add(key);
    if (depth >= maxDepth) {
      ctx.cutShort = true;
      return false;
    }
    for (const move of generateUndoMoves(work)) {
      const undo = applyUndoMove(work, move);
      if (!undo) continue;
      const sweeps = sweepSafe(work);
      const home = work.foundationRank.reduce((sum, rank) => sum + rank, 0);
      const won = home === 52;
      if (won || search(depth + 1)) {
        return true;
      }
      undoSweep(work, sweeps);
      undo();
    }
    return false;
  };

  try {
    return search(0) ? 'solvable' : 'unsolvable';
  } catch (error) {
    if (error === BUDGET_ABORT) {
      ctx.cutShort = true;
      return 'unknown';
    }
    throw error;
  }
}

/**
 * Solve for 'is the game winnable from here', matching the game as actually
 * played (every action is followed by the forced safe-autoplay sweep).
 * FreeCell uses best-first; Klondike tries ordered DFS first, then a
 * best-first pass with any leftover budget.
 */
export function solveSolitaire(state: SolitaireState, options: SolveOptions = {}): SolveVerdict {
  const budgetMs = options.budgetMs ?? 5000;
  const maxNodes = options.maxNodes ?? 400_000;

  if (state.variant === 'freecell') {
    return searchBestFirst(state, makeContext(budgetMs, maxNodes));
  }

  const dfsContext = makeContext(budgetMs * 0.65, maxNodes);
  const dfsVerdict = searchDfs(state, dfsContext, 1500);
  if (dfsVerdict !== 'unknown') return dfsVerdict;

  const bestFirstContext = makeContext(budgetMs * 0.3, maxNodes);
  const bestFirstVerdict = searchBestFirst(state, bestFirstContext);
  return bestFirstVerdict;
}
