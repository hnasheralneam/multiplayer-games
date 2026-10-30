import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PublicRoom } from '../../shared/types';
import { GAME_META } from '../../shared/types';
import { fetchConfig } from '../lib/api';
import { copyText } from '../lib/copy';
import {
  IconCheck,
  IconCopy,
  IconLink,
  IconQR,
  IconShare,
  IconX
} from './icons';
import { QRCodeImage } from './ui';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function isPrivateHost(host: string): boolean {
  return (
    LOCAL_HOSTS.has(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host.endsWith('.local')
  );
}

export function InvitePanel({ room }: { room: PublicRoom }) {
  const [lanHost, setLanHost] = useState<string | null>(null);
  const [copied, setCopied] = useState<'link' | 'code' | null>(null);
  const [fallback, setFallback] = useState<string | null>(null);
  const [showJoinScreen, setShowJoinScreen] = useState(false);
  const [sharing, setSharing] = useState(false);

  const localHost = LOCAL_HOSTS.has(window.location.hostname);

  useEffect(() => {
    if (!localHost) return;
    let cancelled = false;
    fetchConfig().then((config) => {
      if (!cancelled) setLanHost(config.lanHost);
    });
    return () => {
      cancelled = true;
    };
  }, [localHost]);

  useEffect(() => {
    if (!showJoinScreen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowJoinScreen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('modal-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('modal-open');
    };
  }, [showJoinScreen]);

  const port = window.location.port ? `:${window.location.port}` : '';
  const origin =
    localHost && lanHost
      ? `${window.location.protocol}//${lanHost}${port}`
      : window.location.origin;
  const url = `${origin}/r/${room.code}`;
  const host = room.players.find((player) => player.isHost);
  const roomName = host ? `${host.name}'s room` : `Room ${room.code}`;
  const isLan = window.location.protocol === 'http:' && isPrivateHost(window.location.hostname);
  const canShare = typeof navigator.share === 'function' && window.isSecureContext;
  const full = room.players.length >= room.settings.maxPlayers;

  const flash = (kind: 'link' | 'code') => {
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 2100);
  };

  const copy = async (text: string, kind: 'link' | 'code') => {
    const ok = await copyText(text);
    if (ok) {
      setFallback(null);
      flash(kind);
    } else {
      setFallback(text);
    }
  };

  const share = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      await navigator.share({
        title: `${GAME_META[room.settings.game].label}, together`,
        text: `Join my ${GAME_META[room.settings.game].label} room`,
        url
      });
    } catch {
    } finally {
      setSharing(false);
    }
  };

  const joinScreen = showJoinScreen
    ? createPortal(
        <div className="join-screen" role="dialog" aria-modal="true" aria-label="Join screen">
          <button
            className="join-screen-close icon-button"
            onClick={() => setShowJoinScreen(false)}
            aria-label="Close join screen"
          >
            <IconX size={22} />
          </button>
          <span className="eyebrow">
            <span className="eyebrow-dot" /> Scan to join
          </span>
          <h2>{roomName}</h2>
          <div className="join-screen-qr">
            <QRCodeImage text={url} size={300} />
          </div>
          <div className="join-screen-code" aria-label={`Room code ${room.code.split('').join(' ')}`}>
            {room.code.split('').map((character, index) => (
              <span key={index}>{character}</span>
            ))}
          </div>
          <p className="join-screen-note">Scan with your camera, or just say the code.</p>
          <div className="join-screen-url">{url}</div>
          {isLan && <span className="lan-chip">Same Wi-Fi as the host</span>}
          <button className="button button-primary" onClick={() => setShowJoinScreen(false)}>
            Done
          </button>
        </div>,
        document.body
      )
    : null;

  return (
    <section className="invite-panel" aria-label="Invite players">
      <div className="invite-head">
        <div>
          <span className="eyebrow">Invite your crew</span>
          <h2>{full ? 'The table is full.' : 'Scan, say it, or send it.'}</h2>
        </div>
        <span className="invite-count">
          {room.players.length}/{room.settings.maxPlayers} in
        </span>
      </div>

      <div className="invite-body">
        <div className="invite-qr">
          <QRCodeImage text={url} size={142} />
          <span className="invite-qr-label">Point a camera</span>
        </div>

        <div className="invite-info">
          <div className="invite-code-row">
            <button
              className="invite-code"
              onClick={() => void copy(room.code, 'code')}
              aria-label={`Copy room code ${room.code}`}
            >
              {room.code.split('').map((character, index) => (
                <span key={index}>{character}</span>
              ))}
            </button>
            <span className="invite-code-hint">
              {copied === 'code' ? 'Code copied' : 'Say it out loud'}
            </span>
          </div>

          <div className="invite-link-row">
            <div className="invite-link">
              <IconLink size={15} />
              <span>{url.replace(/^https?:\/\//, '')}</span>
            </div>
            <button className="button button-primary button-sm" onClick={() => void copy(url, 'link')}>
              {copied === 'link' ? <IconCheck size={16} /> : <IconCopy size={16} />}
              {copied === 'link' ? 'Copied' : 'Copy link'}
            </button>
          </div>

          <div className="invite-actions">
            <button className="button button-secondary button-sm" onClick={() => setShowJoinScreen(true)}>
              <IconQR size={16} /> Show join screen
            </button>
            {canShare && (
              <button
                className="button button-ghost button-sm"
                onClick={() => void share()}
                disabled={sharing}
              >
                <IconShare size={16} /> Share
              </button>
            )}
          </div>

          <p className="invite-note">
            {full
              ? 'Every seat is taken. The link starts working again if one opens.'
              : `Anyone with the code can join. ${isLan ? 'This one is on your local Wi-Fi only.' : 'The code stays the same next round.'}`}
          </p>
        </div>
      </div>

      {fallback && (
        <div className="copy-fallback" role="status">
          <label htmlFor="copy-fallback-input">Copy this by hand:</label>
          <input
            id="copy-fallback-input"
            value={fallback}
            readOnly
            autoFocus
            onFocus={(event) => event.currentTarget.select()}
          />
          <span>Press ⌘C / Ctrl+C</span>
        </div>
      )}

      {joinScreen}
    </section>
  );
}
