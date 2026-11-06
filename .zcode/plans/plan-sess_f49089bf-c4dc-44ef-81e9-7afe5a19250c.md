# Add Sudoku notes (pencil marks) + run dev testing on a different port

## Context
The Sudoku game has no way to jot candidate digits — a standard Sudoku feature. Add **private, client-local pencil marks** (visible only to you; no server/protocol changes — standard Sudoku behavior, chosen as the sensible default since no preference was given; filled digits remain the only shared state).

Separately, dev/browser testing currently collides on port 3000 (often held by another instance) and, worse, `vite.config.ts` hardcodes the proxy target at 3000 — so if the backend can't bind 3000, Vite would silently proxy to the *wrong* server. Make the dev-stack ports env-driven (defaults unchanged), then run verification on 3001/5174.

## Part 1 — Sudoku notes

### `src/client/components/SudokuGame.tsx` (main changes)
- New local state next to `selected` (line 42): `notes: Map<number, Set<number>>` (cell index → candidate digits) and `notesMode: boolean`. Reset both in the existing `useEffect` on `sudoku?.id` (lines 44–46).
- **Pad behavior**: `put(digit)` (line 90) — when `notesMode` is on and the selected cell is playable and empty (no entry), toggle the digit in that cell's note set instead of sending an entry. When a digit entry is placed (notes mode off), clear that cell's notes.
- **Keyboard** (`onKeyDown`, lines 95–121):
  - Line 96 lets Shift through but Shift+digit produces `!@#$%^&*(` so the `/^[1-9]$/` test never fires — add a Shift+digit check *before* it using `event.code` (`Digit1-9`/`Numpad1-9`) with `event.shiftKey` → toggle note.
  - `n` key toggles notes mode.
  - Backspace/Delete/0 in notes mode clears all notes of the selected cell (when it has no entry); otherwise existing erase-entry behavior.
- **Pad UI** (aside, lines 173–217): add a **Notes** toggle button in a row with Erase, styled like `.sudoku-erase` plus an active (accent) state — same pattern as Minesweeper's reveal/flag `mode` state in `Game.tsx:47`. Update help text: "Shift + number or N for notes".
- Gating: notes only on cells that are playable, not given, and have no entry; notes are hidden whenever a cell shows a digit.

### `src/client/components/SudokuBoard.tsx`
- Add optional `notes?: Map<number, Set<number>>` prop to `SudokuBoardProps` (line 9).
- Cell render (line 84): when `!digit`, render a 3×3 mini-grid `<span className="sudoku-notes">` with 9 slots, only noted digits visible; extend the `aria-label` with the noted digits.

### `src/client/styles.css` (sudoku section ~2601–2810)
- `.sudoku-notes`: absolutely-positioned 3×3 grid filling the cell; slot font-size ~`min(calc(100cqw / 27), 11px)`, muted color, matching the light-first minimal design language; noted slots show the digit, others stay empty.
- Notes-toggle active state (accent border/text) alongside `.sudoku-erase`.

## Part 2 — Env-driven dev ports

### `vite.config.ts`
- `const backendPort = process.env.PORT ?? '3000'` → `/api` target `http://localhost:${backendPort}`, `/ws` target `ws://localhost:${backendPort}` (lines 11, 13).
- `const devPort = Number(process.env.DEV_PORT ?? 5173)` for `server.port` (line 8). Keep `strictPort`.
- Server already reads `PORT` (`src/server/index.ts:14`), so `PORT=3001 DEV_PORT=5174 npm run dev` moves the whole stack; defaults are unchanged.

## Verification
1. `npm run typecheck` and `npm test` (vitest unit tests don't use ports; confirms nothing broke).
2. Check what holds :3000/3001/5174 (`ss -tlnp`), then run `PORT=3001 DEV_PORT=5174 npm run dev` in the background.
3. Browser-verify at http://localhost:5174 (control-browser skill; note quirks: use native clicks via evaluate, touch files if HMR serves stale modules): create room → start Sudoku → toggle Notes → add/toggle notes via pad and Shift+digit → verify 3×3 mini-grid renders only on empty cells → place a digit (its notes clear) → erase notes with Delete/Erase → `n` toggles mode → confirm notes are not sent over the socket (other player unaffected).

## Files modified
- `src/client/components/SudokuGame.tsx`, `src/client/components/SudokuBoard.tsx`, `src/client/styles.css`, `vite.config.ts`
- No changes to `src/server/`, `src/shared/types.ts`, or tests.