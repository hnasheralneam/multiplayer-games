import { solveSolitaire, type SolveVerdict } from './solitaireSolver';
import type { SolitaireState } from '../../shared/solitaire';

interface SolveRequest {
  id: number;
  state: SolitaireState;
  budgetMs?: number;
}

interface SolveResponse {
  id: number;
  verdict: SolveVerdict;
}

// The tsconfig has no WebWorker lib; a minimal local view of `self` avoids
// pulling DOM window types into the worker.
const ctx = self as unknown as {
  onmessage: ((event: MessageEvent<SolveRequest>) => void) | null;
  postMessage(message: SolveResponse): void;
};

ctx.onmessage = (event) => {
  const { id, state, budgetMs } = event.data;
  const verdict = solveSolitaire(state, { budgetMs });
  ctx.postMessage({ id, verdict });
};
