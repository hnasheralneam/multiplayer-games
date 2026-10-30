import { useEffect, useRef, useState, type FormEvent } from 'react';
import { extractCode } from '../../shared/types';
import { loadRecent } from '../lib/storage';
import { Link, navigate } from '../lib/router';
import { timeAgo } from '../lib/format';
import { IconArrow, IconQR, IconUsers } from '../components/icons';
import { Logo, ThemeToggle } from '../components/ui';

export function JoinPage() {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [recent] = useState(() => loadRecent());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = 'Join a room · Games, together';
    if (window.matchMedia('(pointer: fine)').matches) {
      inputRef.current?.focus();
    }
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const code = extractCode(value);
    if (!code) {
      setError('Codes are four characters. Check the host screen and try again.');
      return;
    }
    setError(null);
    navigate(`/r/${code}`);
  };

  return (
    <div className="site site-narrow">
      <header className="site-header">
        <Logo />
        <nav className="site-nav">
          <Link to="/">Home</Link>
          <ThemeToggle />
        </nav>
      </header>

      <main className="join-page">
        <div className="join-card join-card-page">
          <span className="eyebrow">
            <IconUsers size={14} /> Two to eight players
          </span>
          <h1>Join a room</h1>
          <p className="join-lede">
            Type the four characters from the host’s screen. Or paste the link they sent you —
            that works too.
          </p>

          <form onSubmit={submit} className="join-form">
            <label htmlFor="room-code" className="field-label">
              Room code
            </label>
            <input
              ref={inputRef}
              id="room-code"
              className="code-input code-input-hero"
              value={value}
              onChange={(event) => {
                setValue(event.target.value.toUpperCase());
                setError(null);
              }}
              placeholder="K7QP"
              maxLength={32}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              inputMode="text"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'code-error' : undefined}
            />
            {error && (
              <p className="field-error" id="code-error">
                {error}
              </p>
            )}
            <button className="button button-primary button-xl" type="submit">
              Join room <IconArrow size={19} />
            </button>
          </form>

          <div className="join-tip">
            <IconQR size={20} />
            <p>
              In person? Ask the host to tap <strong>Show join screen</strong>. Scan the QR and
              you are in.
            </p>
          </div>

          {recent.length > 0 && (
            <div className="join-recent">
              <span className="field-label">Recent rooms</span>
              {recent.map((room) => (
                <Link className="recent-row" to={`/r/${room.code}`} key={room.code}>
                  <code>{room.code}</code>
                  <span>{room.label ?? 'Games room'}</span>
                  <span className="recent-time">{timeAgo(room.at)}</span>
                  <IconArrow size={16} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
