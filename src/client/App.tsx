import { useEffect } from 'react';
import { normalizeCode } from '../shared/types';
import { usePath, Link } from './lib/router';
import { Home } from './pages/Home';
import { JoinPage } from './pages/JoinPage';
import { RoomPage } from './pages/RoomPage';
import { Logo } from './components/ui';
import { IconArrow } from './components/icons';

function InvalidCode({ code }: { code: string }) {
  useEffect(() => {
    document.title = 'Room not found · Games, together';
  }, []);
  return (
    <div className="center-page">
      <div className="center-card">
        <Logo />
        <span className="eyebrow">That is not a room code</span>
        <h1>{code.slice(0, 12)} is not four characters.</h1>
        <p>
          Codes use four letters and numbers, and skip the confusing ones. Check the host's
          screen and try again.
        </p>
        <div className="center-actions">
          <Link className="button button-primary button-xl" to="/join">
            Try a code <IconArrow size={18} />
          </Link>
          <Link className="button button-secondary button-xl" to="/">
            Back home
          </Link>
        </div>
      </div>
    </div>
  );
}

function NotFound() {
  useEffect(() => {
    document.title = 'Not found · Games, together';
  }, []);
  return (
    <div className="center-page">
      <div className="center-card">
        <Logo />
        <span className="eyebrow">404</span>
        <h1>Nothing lives here.</h1>
        <p>This page is not a room. The mines are that way.</p>
        <div className="center-actions">
          <Link className="button button-primary button-xl" to="/">
            Back home <IconArrow size={18} />
          </Link>
        </div>
      </div>
    </div>
  );
}

export function App() {
  const path = usePath();
  const parts = path.split('/').filter(Boolean);

  if (path === '/') return <Home />;
  if (path === '/join') return <JoinPage />;

  if (parts[0] === 'r' && parts.length === 2) {
    const code = normalizeCode(parts[1]);
    if (!code) return <InvalidCode code={parts[1]} />;
    return <RoomPage key={code} code={code} />;
  }

  return <NotFound />;
}
