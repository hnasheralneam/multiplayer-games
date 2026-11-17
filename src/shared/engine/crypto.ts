// Randomness and token helpers that work in both Node (>=18) and browsers,
// built on the Web Crypto globals. The engine must never import node:crypto,
// so everything random flows through here.

const webcrypto: Crypto = globalThis.crypto;

// The same unambiguous alphabet the room codes use (no vowels, no 0/1).
const ID_ALPHABET = '23456789BCDFGHJKMNPQRSTVWXYZ';

/**
 * Short random id (8 chars) for players and rounds. 28^8 combinations is far
 * more than a room of eight ever needs, and 8 chars beat a 36-char UUID in
 * every message that carries a player id.
 */
export function newId(): string {
  const bytes = new Uint8Array(8);
  webcrypto.getRandomValues(bytes);
  let id = '';
  for (const byte of bytes) id += ID_ALPHABET[byte % ID_ALPHABET.length];
  return id;
}

/** Uniform integer in [min, max) via rejection sampling on 32-bit draws. */
export function randInt(min: number, max: number): number {
  const span = max - min;
  if (span <= 1) return min;
  const limit = Math.floor(0xffffffff / span) * span;
  const buffer = new Uint32Array(1);
  let value: number;
  do {
    webcrypto.getRandomValues(buffer);
    value = buffer[0];
  } while (value >= limit);
  return min + (value % span);
}

/** Random opaque string for room resume tokens. */
export function newToken(): string {
  const bytes = new Uint8Array(16);
  webcrypto.getRandomValues(bytes);
  let hex = '';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return hex;
}

// Room auth stores only a hash of each resume token. The server installs a
// real SHA-256 here at boot; solo rooms (which never leave the tab) are fine
// with the identity function, so async digest APIs never reach the engine.
let tokenHash: (token: string) => string = (token) => token;

export function setTokenHash(hash: (token: string) => string): void {
  tokenHash = hash;
}

export function hashToken(token: string): string {
  return tokenHash(token);
}
