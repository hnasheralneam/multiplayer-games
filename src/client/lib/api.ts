import {
  normalizeCode,
  type GameKind,
  type KlondikeDraw,
  type PresetId,
  type PublicRoom
} from '../../shared/types';

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 0, code = 'network') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function readError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as { error?: string; message?: string };
    return new ApiError(
      body.message ?? 'Something broke on our end.',
      response.status,
      body.error ?? 'unknown'
    );
  } catch {
    return new ApiError('Something broke on our end.', response.status, 'unknown');
  }
}

export interface CreateRoomOptions {
  game?: GameKind;
  preset?: PresetId;
  lives?: number;
  maxPlayers?: number;
  lateJoin?: boolean;
  klondikeDraw?: KlondikeDraw;
}

export async function createRoom(
  options: CreateRoomOptions = {}
): Promise<{ code: string; token: string }> {
  let response: Response;
  try {
    response = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    });
  } catch {
    throw new ApiError('Could not reach the room server. Check your connection.', 0, 'network');
  }
  if (!response.ok) throw await readError(response);
  return (await response.json()) as { code: string; token: string };
}

export interface AppConfig {
  lanHost: string | null;
  publicOrigin: string | null;
}

export async function fetchConfig(): Promise<AppConfig> {
  try {
    const response = await fetch('/api/config', { cache: 'no-store' });
    if (!response.ok) return { lanHost: null, publicOrigin: null };
    return (await response.json()) as AppConfig;
  } catch {
    return { lanHost: null, publicOrigin: null };
  }
}

export interface Preview {
  room: PublicRoom;
  serverNow: number;
}

export async function fetchRoom(codeInput: string): Promise<Preview> {
  const code = normalizeCode(codeInput);
  if (!code) throw new ApiError('That code is not valid.', 400, 'invalid_code');
  let response: Response;
  try {
    response = await fetch(`/api/rooms/${code}`, { cache: 'no-store' });
  } catch {
    throw new ApiError('Could not reach the room. Check you are on the same Wi-Fi.', 0, 'network');
  }
  if (response.status === 404) {
    throw new ApiError('That room does not exist.', 404, 'not_found');
  }
  if (!response.ok) throw await readError(response);
  return (await response.json()) as Preview;
}
