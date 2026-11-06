import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import type { Avatar as AvatarType } from '../../shared/types';
import { IconMine, IconMoon, IconSun } from './icons';
import { Link } from '../lib/router';
import { toggleTheme, useTheme } from '../lib/theme';

export function Logo({ small = false }: { small?: boolean }) {
  return (
    <Link className={`logo ${small ? 'logo-small' : ''}`} to="/" aria-label="Games home">
      <span className="logo-mark">
        <IconMine size={small ? 18 : 22} />
      </span>
      <span className="logo-word">
        games
        <span className="logo-tag">together</span>
      </span>
    </Link>
  );
}

export function ThemeToggle({ className = '' }: { className?: string }) {
  const theme = useTheme();
  const next = theme === 'light' ? 'dark' : 'light';
  return (
    <button
      type="button"
      className={`icon-button theme-toggle ${className}`}
      onClick={toggleTheme}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
    >
      {theme === 'light' ? <IconMoon size={18} /> : <IconSun size={18} />}
    </button>
  );
}

export function Avatar({
  avatar,
  color,
  size = 38,
  connected,
  muted = false
}: {
  avatar: AvatarType;
  color: string;
  size?: number;
  connected?: boolean;
  muted?: boolean;
}) {
  return (
    <span
      className={`avatar ${muted ? 'avatar-muted' : ''}`}
      style={
        {
          width: size,
          height: size,
          fontSize: Math.round(size * 0.48),
          borderColor: color,
          boxShadow: `0 0 0 3px ${color}22`
        } as CSSProperties
      }
      aria-hidden="true"
    >
      {avatar}
      {connected === false && <span className="avatar-offline" title="Disconnected" />}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
  className = ''
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    document.body.classList.add('modal-open');
    const focusables = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) ?? []
      );
    const timer = window.setTimeout(() => focusables()[0]?.focus(), 40);

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('modal-open');
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={`modal ${wide ? 'modal-wide' : ''} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="toast" role="status" aria-live="polite">
      {message}
    </div>
  );
}

export function QRCodeImage({
  text,
  size = 240,
  className = ''
}: {
  text: string;
  size?: number;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    setFailed(false);
    QRCode.toDataURL(text, {
      width: size * 2,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0b0e13ff', light: '#ffffffff' }
    })
      .then((data) => {
        if (!cancelled) setSrc(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [text, size]);

  if (failed) {
    return <div className={`qr-placeholder ${className}`}>QR unavailable — use the code</div>;
  }
  if (!src) {
    return <div className={`qr-placeholder ${className}`} aria-hidden="true" />;
  }
  return (
    <img
      className={`qr-image ${className}`}
      src={src}
      width={size}
      height={size}
      alt={`QR code to join room ${text.split('/').pop() ?? ''}`}
    />
  );
}

export function Hearts({ lives, total }: { lives: number; total: number }) {
  const count = Math.max(total, lives, 1);
  return (
    <span className="hearts" aria-label={`${lives} ${lives === 1 ? 'life' : 'lives'} left`}>
      {Array.from({ length: count }, (_, index) => (
        <span key={index} className={`heart ${index < lives ? 'heart-full' : 'heart-empty'}`}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 20.3S3.6 15.4 3.6 9.5A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 8.4 2.2c0 5.9-8.4 10.8-8.4 10.8Z" />
          </svg>
        </span>
      ))}
    </span>
  );
}

const CONFETTI_COLORS = ['#f5b942', '#2dd4bf', '#ff7a59', '#c084fc', '#38bdf8', '#f472b6'];

export function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 42 }, (_, index) => ({
        id: index,
        left: Math.random() * 100,
        delay: Math.random() * 0.7,
        duration: 1.6 + Math.random() * 1.4,
        drift: (Math.random() - 0.5) * 30,
        spin: Math.random() * 720 - 360,
        color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
        width: 5 + Math.random() * 6
      })),
    []
  );
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((piece) => (
        <span
          key={piece.id}
          style={
            {
              left: `${piece.left}%`,
              animationDelay: `${piece.delay}s`,
              animationDuration: `${piece.duration}s`,
              background: piece.color,
              width: piece.width,
              height: piece.width * 0.55,
              '--drift': `${piece.drift}vw`,
              '--spin': `${piece.spin}deg`
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

export function useNow(interval = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(timer);
  }, [interval]);
  return now;
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <span className="spinner" role="status" aria-label={label}>
      <span />
    </span>
  );
}

export function StatusPill({
  tone = 'neutral',
  children
}: {
  tone?: 'neutral' | 'live' | 'warm' | 'success';
  children: ReactNode;
}) {
  return <span className={`status-pill status-${tone}`}>{children}</span>;
}
