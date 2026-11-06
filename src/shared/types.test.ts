import { describe, expect, it } from 'vitest';
import {
  AVATARS,
  extractCode,
  isAvatar,
  normalizeCode
} from './types';
import { parseClientMessage } from '../server/protocol';

describe('room codes', () => {
  it('normalizes case and whitespace', () => {
    expect(normalizeCode(' k7qp ')).toBe('K7QP');
  });

  it('rejects ambiguous or wrong-length codes', () => {
    expect(normalizeCode('K7Q')).toBeNull();
    expect(normalizeCode('K7QO')).toBeNull();
    expect(normalizeCode('K7QPX')).toBeNull();
    expect(normalizeCode('K7Q1')).toBeNull();
  });

  it('pulls a code out of a pasted link', () => {
    expect(extractCode('https://play.example/r/K7QP')).toBe('K7QP');
    expect(extractCode('http://192.168.1.4:3000/r/K7QP?x=1')).toBe('K7QP');
    expect(extractCode('K7QP')).toBe('K7QP');
  });
});

describe('avatars', () => {
  it('accepts every shipped avatar and rejects others', () => {
    for (const avatar of AVATARS) expect(isAvatar(avatar)).toBe(true);
    expect(isAvatar('🙂')).toBe(false);
  });
});

describe('protocol', () => {
  it('parses a join message', () => {
    const message = parseClientMessage(
      JSON.stringify({ t: 'join', code: 'K7QP', name: 'Maya', avatar: '🦊' })
    );
    expect(message).toMatchObject({ t: 'join', code: 'K7QP', name: 'Maya' });
  });

  it('rejects junk and unknown message types', () => {
    expect(parseClientMessage('not json')).toBeNull();
    expect(parseClientMessage(JSON.stringify({ t: 'shoot' }))).toBeNull();
  });

  it('rejects out-of-range cursor coordinates', () => {
    expect(parseClientMessage(JSON.stringify({ t: 'cursor', x: 2, y: 0 }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ t: 'cursor', x: 0.4, y: 0.9 }))).not.toBeNull();
  });

  it('parses solitaire moves and game settings', () => {
    expect(
      parseClientMessage(
        JSON.stringify({
          t: 'solitaire',
          action: 'move',
          card: 24,
          to: { zone: 'tableau', index: 2 }
        })
      )
    ).toMatchObject({ t: 'solitaire', action: 'move', card: 24 });
    expect(
      parseClientMessage(
        JSON.stringify({
          t: 'settings',
          game: 'klondike',
          preset: 'classic',
          lives: 2,
          maxPlayers: 8,
          lateJoin: true,
          sudokuDifficulty: 'medium',
          klondikeDraw: 3,
          mahjongLayout: 'turtle'
        })
      )
    ).toMatchObject({ t: 'settings', game: 'klondike', klondikeDraw: 3 });
    expect(
      parseClientMessage(
        JSON.stringify({
          t: 'mahjong',
          action: 'match',
          a: 3,
          b: 140
        })
      )
    ).toMatchObject({ t: 'mahjong', action: 'match', a: 3, b: 140 });
    expect(
      parseClientMessage(JSON.stringify({ t: 'mahjong', action: 'select', i: 12 }))
    ).toMatchObject({ t: 'mahjong', action: 'select', i: 12 });
    expect(
      parseClientMessage(JSON.stringify({ t: 'mahjong', action: 'select', i: null }))
    ).toMatchObject({ t: 'mahjong', action: 'select', i: null });
    expect(
      parseClientMessage(JSON.stringify({ t: 'mahjong', action: 'select', i: 144 }))
    ).toBeNull();
    expect(
      parseClientMessage(JSON.stringify({ t: 'mahjong', action: 'match', a: 999, b: 0 }))
    ).toBeNull();
    expect(
      parseClientMessage(JSON.stringify({ t: 'solitaire', action: 'move', card: 99, to: { zone: 'tableau', index: 0 } }))
    ).toBeNull();
  });
});
