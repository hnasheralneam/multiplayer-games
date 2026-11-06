import { useEffect } from 'react';
import { normalizeCode } from '../shared/types';
import { usePath, Link } from './lib/router';
import { Home } from './pages/Home';
import { JoinPage } from './pages/JoinPage';
import { RoomPage } from './pages/RoomPage';
import { StateScreen } from './components/StateScreen';
import { IconArrow } from './components/icons';

function InvalidCode({ code }: { code: string }) {
  useEffect(() => {
    document.title = 'Room not found · Games, together';
  }, []);
  return (
    <StateScreen
      logo
      eyebrow="That is not a room code"
      title={`${code.slice(0, 12)} is not four characters.`}
      body="Codes use four letters and numbers, and skip the confusing ones. Check the host's screen and try again."
      actions={
        <>
          <Link className="button button-primary button-xl" to="/join">
            Try a code <IconArrow size={18} />
          </Link>
          <Link className="button button-secondary button-xl" to="/">
            Back home
          </Link>
        </>
      }
    />
  );
}

function NotFound() {
  useEffect(() => {
    document.title = 'Not found · Games, together';
  }, []);
  return (
    <StateScreen
      logo
      eyebrow="404"
      title="Nothing lives here."
      body="This page is not a room. The mines are that way."
      actions={
        <Link className="button button-primary button-xl" to="/">
          Back home <IconArrow size={18} />
        </Link>
      }
    />
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
