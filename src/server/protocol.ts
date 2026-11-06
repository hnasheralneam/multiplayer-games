import { z } from 'zod';
import type { ClientMessage } from '../shared/types';

const settings = z.object({
  game: z.enum(['minesweeper', 'sudoku', 'klondike', 'freecell', 'mahjong']),
  preset: z.enum(['cozy', 'classic', 'big']),
  lives: z.number().int().min(1).max(5),
  maxPlayers: z.number().int().min(2).max(8),
  lateJoin: z.boolean(),
  sudokuDifficulty: z.enum(['easy', 'medium', 'hard']),
  klondikeDraw: z.union([z.literal(1), z.literal(3)]),
  mahjongLayout: z.enum(['turtle', 'pyramid', 'cozy'])
});

const slot = z.object({
  zone: z.enum(['tableau', 'foundation', 'freecell']),
  index: z.number().int().min(0).max(7)
});

const join = z.object({
  t: z.literal('join'),
  code: z.string().min(1).max(200),
  name: z.string().max(80).optional(),
  avatar: z.string().max(16).optional(),
  token: z.string().max(200).optional(),
  spectate: z.boolean().optional()
});

const schema = z.discriminatedUnion('t', [
  join,
  z.object({ t: z.literal('profile'), name: z.string().max(80), avatar: z.string().max(16) }),
  z.object({ t: z.literal('settings') }).merge(settings),
  z.object({ t: z.literal('start') }),
  z.object({ t: z.literal('reveal'), i: z.number().int().nonnegative() }),
  z.object({ t: z.literal('flag'), i: z.number().int().nonnegative() }),
  z.object({ t: z.literal('chord'), i: z.number().int().nonnegative() }),
  z.object({
    t: z.literal('sudoku'),
    i: z.number().int().min(0).max(80),
    digit: z.number().int().min(0).max(9)
  }),
  z.object({
    t: z.literal('solitaire'),
    action: z.enum(['draw', 'recycle', 'move', 'auto']),
    card: z.number().int().min(0).max(51).optional(),
    to: slot.optional()
  }),
  z.object({
    t: z.literal('mahjong'),
    action: z.enum(['match', 'shuffle']),
    a: z.number().int().min(0).max(143).optional(),
    b: z.number().int().min(0).max(143).optional()
  }),
  z.object({ t: z.literal('lobby') }),
  z.object({
    t: z.literal('cursor'),
    x: z.number().finite().min(-1).max(1),
    y: z.number().finite().min(-1).max(1)
  }),
  z.object({ t: z.literal('leave') }),
  z.object({ t: z.literal('close') })
]);

export function parseClientMessage(raw: string): ClientMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = schema.safeParse(value);
  if (!result.success) return null;
  return result.data as ClientMessage;
}
