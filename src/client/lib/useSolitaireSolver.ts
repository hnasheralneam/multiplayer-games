import { useEffect, useRef, useState } from 'react';
import SolverWorker from './solitaireSolver.worker?worker';
import { solitaireView } from './solitaireView';
import type { PublicSolitaire } from '../../shared/types';

export type SolverStatus = 'idle' | 'checking' | 'solvable' | 'unsolvable' | 'unsure';

const SOLVE_BUDGET_MS = 5000;
const SOLVE_DEBOUNCE_MS = 400;

/**
 * Runs the solvability solver in a web worker whenever the shared table
 * changes (identified by round id + move count, the only things that can
 * alter the position). Terminates and respawns the worker when a newer
 * request supersedes a running search.
 */
export function useSolitaireSolver(
  solitaire: PublicSolitaire | undefined,
  enabled: boolean
): SolverStatus {
  const [status, setStatus] = useState<SolverStatus>('idle');
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const solvedKeyRef = useRef<string | null>(null);
  const solitaireRef = useRef(solitaire);
  solitaireRef.current = solitaire;

  const gameKey = solitaire ? `${solitaire.id}:${solitaire.moves}` : '';

  useEffect(() => {
    const current = solitaireRef.current;
    if (!enabled || !current) {
      requestIdRef.current += 1;
      workerRef.current?.terminate();
      workerRef.current = null;
      solvedKeyRef.current = null;
      setStatus('idle');
      return;
    }

    const key = `${current.id}:${current.moves}`;
    if (key === solvedKeyRef.current) return;
    solvedKeyRef.current = key;
    setStatus('checking');

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    const timer = window.setTimeout(() => {
      if (requestIdRef.current !== requestId) return;
      workerRef.current?.terminate();
      const worker = new SolverWorker();
      workerRef.current = worker;
      worker.onmessage = (event: MessageEvent<{ id: number; verdict: string }>) => {
        if (event.data.id !== requestIdRef.current) return;
        const { verdict } = event.data;
        setStatus(
          verdict === 'solvable' ? 'solvable' : verdict === 'unsolvable' ? 'unsolvable' : 'unsure'
        );
      };
      worker.postMessage({
        id: requestId,
        state: solitaireView(current),
        budgetMs: SOLVE_BUDGET_MS
      });
    }, SOLVE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [enabled, gameKey]);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  return status;
}
