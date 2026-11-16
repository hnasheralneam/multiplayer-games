// Randomness and token helpers that work in both Node (>=18) and browsers,
// built on the Web Crypto globals. The engine must never import node:crypto,
// so everything random flows through here.

const webcrypto: Crypto = globalThis.crypto;

/** RFC 4122 v4 id, used for player and round ids. */
export function newId(): string {
  return webcrypto.randomUUID();
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
