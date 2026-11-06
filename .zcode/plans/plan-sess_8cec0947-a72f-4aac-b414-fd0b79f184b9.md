# Mahjongg Overhaul: Real Depth, No Hand-Holding

## Context

The mahjongg game built earlier today has two confirmed problems: (1) tiles render flat — every layer sits grid-aligned with only a 2px shadow, so the stack's depth is invisible; (2) when a tile is selected, all matching free tiles light up (`mj-tile-hint`) and free tiles are visually distinguished from covered ones — this does the player's scanning for them. Confirmed decisions: **3D block tiles + per-layer lift**, **zero free/blocked/hint indicators** (geometry is the only tell; selection ring on the picked tile stays), and **full visual polish** (tile faces + stage). Server engine, layouts, and protocol are untouched — this is a presentation-layer overhaul.

Files verified current (no drift from the other session): `MahjongBoard.tsx`, `MahjongGame.tsx`, styles.css section "20. Mahjongg" (lines 3262–3537), tokens at styles.css:105–117 (light) and 171–183 (dark).

## 1. Depth rendering — `src/client/components/MahjongBoard.tsx`

**Layer lift (positioning math, `tileStyle` + `boardStyle`, lines 103–113):**
- New constant `LIFT = 0.5` (cells per layer, tile = 2×2 cells). A tile at layer `l` shifts up by `l * LIFT`.
- `totalRowsCells = rows * 2 + (layers - 1) * LIFT` using existing `mahjongTileLayers()` from `shared/mahjong.ts`; board `aspectRatio: (cols * 2) / totalRowsCells`.
- `top% = ((pos.y - pos.l * LIFT + (maxLayer * LIFT)) / totalRowsCells) * 100` — base layer sinks to the bottom of the box, top layer touches the top. `left%` and `zIndex` unchanged.
- Pass `--mj-cols` and `--mj-rows` (redefined as `totalRowsCells / 2`) so tile size CSS keeps working.

**3D block tile (render structure per tile):**
- Button keeps the grid footprint; the face fills the top ~80% and a new side edge hangs below via `::after` (CSS, scales with board size), so a raised tile visibly sits on the one beneath. Painting order already correct (`zIndex = l*1000 + y*2 + x`).
- Soft ambient shadow via `filter: drop-shadow(...)` (covers face + edge); stronger shadow for higher layers via the existing `mj-tile-l{n}` class hook.

## 2. Zero indicators — `MahjongBoard.tsx`

- Delete the `isHint` computation (lines 122–123) and the `free ? 'mj-tile-free' : 'mj-tile-blocked'` class branch (line 130). No `mj-tile-hint` anywhere.
- Tiles are no longer `disabled` (line 137) — `disabled` swallows the click, killing feedback. All tiles are enabled buttons (when `canPlay`); `clickTile` checks `freeSet` and, on a buried/blocked tile, triggers a brief shake: local `shake` state (index + timestamp, cleared by timeout), class `mj-tile-shake`, no selection change. `aria-disabled={!free}` replaces the `disabled` attribute; the ", covered" aria-label suffix stays (a11y without visual cheat).
- Uniform hover (cursor + slight raise) on all tiles — reveals nothing about freeness. Selected tile keeps the amber ring.

## 3. Tile face + stage polish — `src/client/styles.css`

**Tokens (light block ~105–117, dark block ~171–183):** add `--mj-side` / `--mj-side-2` (ivory side-edge gradient stops; dark variants) and tune `--mj-edge`. Keep both themes in sync with the existing 13 `--mj-*` tokens.

**Rewrite the tile rules in section 20 (~3288–3328):**
- `.mj-tile`: glossier face gradient (`165deg` white→face→face-2), inner top highlight (`inset 0 1px 0 rgba(255,255,255,.7)`), border-radius on the face only; `::after` = side edge (`top: 100%`, height ~20% of tile, `linear-gradient(180deg, var(--mj-side), var(--mj-side-2))`, matching side borders + bottom radius).
- Delete `.mj-tile-free`, `.mj-tile-blocked`, `.mj-tile-hint`; add `.mj-tile-shake` and `.mj-tile-l{n}`-scaled shadows.
- Faces: bigger pips (max ~16px, tighter padding), thicker circle rings, taller bamboo-1 stick, slightly larger honor glyphs.
- `.mahjong-stage`: recessed well — `var(--surface-2)` background + inset border treatment so the stack sits "in" the table.

**Keyframes:** add `@keyframes mj-shake` in section "24. Keyframes" (follows the existing convention).

## 4. Help copy — `src/client/components/MahjongGame.tsx`

- Help aside (lines 126–155): drop the legend block ("free edge" / "selected" / "matches light up" — two of the three describe removed affordances). Extend the how-to text: open left/right edge + nothing on top, buried tiles shake when tapped, flowers/seasons note stays. Stats grid and shared-table note unchanged.

## Untouched

`src/shared/mahjong.ts` (engine geometry/freeness still needed server-side + aria), `src/server/*` (rules unchanged), existing tests (no behavior change — presentation only).

## Verification

1. `npm run typecheck` + `npx vitest run` (mahjong/types/room suites — should stay green; presentation-only change).
2. `npm run build`, then isolated instance `PORT=3177 node dist/server/index.js` (recipe in memory; never :3000).
3. Browser E2E (control-browser skill, same tab flow as before): start a Turtle game and screenshot light + dark — verify stacks visibly read as 3D piles with side edges and per-layer lift; select a tile and confirm **no** highlighting of matches; click a buried tile and confirm the shake with no selection; confirm uniform hover; complete a match to confirm the flow still works; quick Cozy responsive sanity check.
4. Stop the isolated server when done.