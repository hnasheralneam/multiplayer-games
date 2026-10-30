import { AVATARS, isAvatar, type Avatar } from '../../shared/types';
import { randomName } from '../../shared/names';

export interface Profile {
  name: string;
  avatar: Avatar;
}

export interface RecentRoom {
  code: string;
  at: number;
  label?: string;
}

const PROFILE_KEY = 'ms:profile';
const RECENT_KEY = 'ms:recent';
const SOUND_KEY = 'ms:sound';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
  }
}

export function loadProfile(): Profile {
  const raw = read(PROFILE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<Profile>;
      if (typeof parsed.name === 'string' && parsed.name.trim()) {
        return {
          name: parsed.name.slice(0, 16),
          avatar: parsed.avatar && isAvatar(parsed.avatar) ? parsed.avatar : AVATARS[0]
        };
      }
    } catch {
    }
  }
  return { name: randomName(), avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)] };
}

export function saveProfile(profile: Profile): void {
  write(PROFILE_KEY, JSON.stringify(profile));
}

export function tokenKey(code: string): string {
  return `ms:token:${code}`;
}

export function loadToken(code: string): string | null {
  return read(tokenKey(code));
}

export function saveToken(code: string, token: string): void {
  write(tokenKey(code), token);
}

export function clearToken(code: string): void {
  write(tokenKey(code), null);
}

export function loadRecent(): RecentRoom[] {
  const raw = read(RECENT_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is RecentRoom =>
          Boolean(item) &&
          typeof item === 'object' &&
          typeof (item as RecentRoom).code === 'string' &&
          typeof (item as RecentRoom).at === 'number'
      )
      .slice(0, 4);
  } catch {
    return [];
  }
}

export function touchRecent(code: string, label?: string): void {
  const existing = loadRecent().filter((room) => room.code !== code);
  const next: RecentRoom[] = [{ code, at: Date.now(), label }, ...existing].slice(0, 4);
  write(RECENT_KEY, JSON.stringify(next));
}

export function removeRecent(code: string): void {
  write(
    RECENT_KEY,
    JSON.stringify(loadRecent().filter((room) => room.code !== code))
  );
}

export function loadSound(): boolean {
  const raw = read(SOUND_KEY);
  if (raw === 'on') return true;
  if (raw === 'off') return false;
  return false;
}

export function saveSound(on: boolean): void {
  write(SOUND_KEY, on ? 'on' : 'off');
}
