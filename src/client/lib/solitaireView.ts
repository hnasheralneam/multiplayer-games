import type { SolitaireState } from '../../shared/solitaire';
import type { PublicSolitaire } from '../../shared/types';

/**
 * The public snapshot now carries the full state (real stock and face-down
 * cards), so the client can rebuild the exact authoritative engine state
 * for local validation and the solver. Read-only use only: engine mutators
 * must never be pointed at the snapshot's arrays.
 */
export function solitaireView(solitaire: PublicSolitaire): SolitaireState {
  return {
    variant: solitaire.variant,
    draw: solitaire.draw,
    stock: solitaire.stock,
    waste: solitaire.waste,
    foundations: solitaire.foundations,
    tableau: solitaire.tableau,
    faceDown: solitaire.faceDown,
    freeCells: solitaire.freeCells,
    passes: solitaire.passes
  };
}
