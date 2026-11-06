import { randomInt } from 'node:crypto';
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  LIVES_OPTIONS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PRESETS,
  isGameKind,
  isKlondikeDraw,
  type GameKind,
  type KlondikeDraw,
  type PresetId,
  type RoomSettings
} from '../shared/types';
import { isMahjongLayout } from '../shared/mahjong';
import { Room, defaultSettings, hashToken, newToken } from './room';

const MAX_ROOMS = 5000;
const CREATE_LIMIT = 12;
const CREATE_WINDOW_MS = 60_000;

export interface CreateInput {
  game?: string;
  preset?: string;
  lives?: number;
  maxPlayers?: number;
  lateJoin?: boolean;
  klondikeDraw?: number;
  mahjongLayout?: string;
}

export type CreateResult =
  | { ok: true; code: string; token: string }
  | { ok: false; reason: 'rate_limited' | 'too_many_rooms' | 'no_code' };

export class RoomRegistry {
  readonly rooms = new Map<string, Room>();
  private creates = new Map<string, number[]>();

  create(ip: string, input: CreateInput = {}): CreateResult {
    if (!this.allowCreate(ip)) return { ok: false, reason: 'rate_limited' };
    if (this.rooms.size >= MAX_ROOMS) return { ok: false, reason: 'too_many_rooms' };

    const presetId: PresetId =
      input.preset && input.preset in PRESETS ? (input.preset as PresetId) : 'classic';
    const preset = PRESETS[presetId];
    const game: GameKind = input.game && isGameKind(input.game) ? input.game : 'minesweeper';
    const klondikeDraw: KlondikeDraw =
      input.klondikeDraw && isKlondikeDraw(input.klondikeDraw) ? input.klondikeDraw : 1;
    const settings: RoomSettings = {
      ...defaultSettings(),
      game,
      preset: presetId,
      width: preset.width,
      height: preset.height,
      mines: preset.mines,
      lives:
        input.lives && (LIVES_OPTIONS as readonly number[]).includes(input.lives)
          ? input.lives
          : 2,
      maxPlayers: Math.max(
        MIN_PLAYERS,
        Math.min(MAX_PLAYERS, Math.floor(input.maxPlayers ?? MAX_PLAYERS))
      ),
      lateJoin: input.lateJoin ?? true,
      klondikeDraw
    };
    if (input.mahjongLayout && isMahjongLayout(input.mahjongLayout)) {
      settings.mahjongLayout = input.mahjongLayout;
    }

    let code = '';
    for (let attempt = 0; attempt < 100; attempt += 1) {
      let candidate = '';
      for (let i = 0; i < CODE_LENGTH; i += 1) {
        candidate += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
      }
      if (!this.rooms.has(candidate)) {
        code = candidate;
        break;
      }
    }
    if (!code) return { ok: false, reason: 'no_code' };

    const token = newToken();
    const room = new Room(code, settings, hashToken(token), (closedCode) => {
      this.rooms.delete(closedCode);
    });
    this.rooms.set(code, room);
    return { ok: true, code, token };
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  sweep(): void {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      room.sweep(now);
      if (room.isExpired(now)) {
        room.destroy('This room closed after a quiet day. Start a new one.');
        this.rooms.delete(code);
      }
    }
    if (this.creates.size > 5000) {
      for (const [ip, times] of this.creates) {
        if (times.every((time) => now - time > CREATE_WINDOW_MS)) this.creates.delete(ip);
      }
    }
  }

  closeAll(): void {
    for (const room of this.rooms.values()) {
      room.destroy('The server is restarting. Start a new room in a moment.');
    }
    this.rooms.clear();
  }

  private allowCreate(ip: string): boolean {
    const now = Date.now();
    const recent = (this.creates.get(ip) ?? []).filter((time) => now - time < CREATE_WINDOW_MS);
    if (recent.length >= CREATE_LIMIT) {
      this.creates.set(ip, recent);
      return false;
    }
    recent.push(now);
    this.creates.set(ip, recent);
    return true;
  }
}
