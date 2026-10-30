import { useEffect, useState, type FormEvent } from 'react';
import { GAME_META, GAME_ORDER, extractCode, type GameKind } from '../../shared/types';
import { createRoom } from '../lib/api';
import { loadProfile, saveProfile, saveToken, touchRecent } from '../lib/storage';
import { navigate, Link } from '../lib/router';
import { IconArrow, IconPlus, IconUsers } from '../components/icons';
import { GameIcon } from '../components/GameIcon';
import { Logo, Spinner, StatusPill, ThemeToggle } from '../components/ui';

const HERO_TILES: Array<{ state: 'hidden' | 'open' | 'flag' | 'mine'; n?: number }> = [
  { state: 'hidden' },
  { state: 'hidden' },
  { state: 'open', n: 1 },
  { state: 'open', n: 0 },
  { state: 'hidden' },
  { state: 'hidden' },
  { state: 'hidden' },
  { state: 'open', n: 2 },
  { state: 'open', n: 1 },
  { state: 'open', n: 0 },
  { state: 'open', n: 1 },
  { state: 'hidden' },
  { state: 'hidden' },
  { state: 'hidden' },
  { state: 'flag' },
  { state: 'open', n: 2 },
  { state: 'open', n: 0 },
  { state: 'open', n: 1 },
  { state: 'open', n: 1 },
  { state: 'hidden' },
  { state: 'hidden' },
  { state: 'hidden' },
  { state: 'hidden' },
  { state: 'open', n: 1 },
  { state: 'open', n: 0 },
  { state: 'open', n: 0 },
  { state: 'hidden' },
  { state: 'hidden' },
  { state: 'hidden' },
  { state: 'hidden' },
  { state: 'hidden' },
  { state: 'open', n: 1 },
  { state: 'hidden' },
  { state: 'mine' },
  { state: 'hidden' }
];

export function Home() {
  const [creating, setCreating] = useState<'group' | 'duo' | GameKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Games, together';
  }, []);

  const create = async (kind: 'group' | 'duo' | 'game', game: GameKind = 'minesweeper') => {
    if (creating) return;
    const busyKey = kind === 'duo' ? 'duo' : kind === 'group' ? 'group' : game;
    setCreating(busyKey);
    setError(null);
    try {
      const profile = loadProfile();
      saveProfile(profile);
      const room = await createRoom(
        kind === 'duo'
          ? { preset: 'cozy', maxPlayers: 2, game }
          : { game }
      );
      saveToken(room.code, room.token);
      touchRecent(
        room.code,
        kind === 'duo' ? 'Duo room' : `${GAME_META[game].label} room`
      );
      navigate(`/r/${room.code}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create a room.');
      setCreating(null);
    }
  };

  const join = (event: FormEvent) => {
    event.preventDefault();
    const normalized = extractCode(code);
    if (!normalized) {
      setCodeError('That code is not four valid characters. Check the screen and try again.');
      return;
    }
    setCodeError(null);
    navigate(`/r/${normalized}`);
  };

  return (
    <div className="site">
      <header className="site-header">
        <Logo />
        <nav className="site-nav">
          <Link to="/join" className="nav-join">
            Join a room
          </Link>
          <ThemeToggle />
        </nav>
      </header>

      <main className="home">
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="eyebrow-dot" /> 2–8 players · no signup
            </div>
            <h1>
              Pull up a chair.
              <br />
              <em>Pick a game.</em>
            </h1>
            <p className="hero-lede">
              One room, one link. Play Minesweeper, Sudoku, Klondike, or FreeCell with the people around you.
            </p>

            <div className="hero-actions">
              <button
                className="button button-primary button-xl"
                onClick={() => void create('group')}
                disabled={Boolean(creating)}
              >
                {creating === 'group' ? <Spinner label="Creating room" /> : <IconPlus size={20} />}
                {creating === 'group' ? 'Making a room…' : 'Create a room'}
              </button>
              <button
                className="button button-secondary button-xl"
                onClick={() => void create('duo')}
                disabled={Boolean(creating)}
              >
                {creating === 'duo' ? <Spinner label="Creating room" /> : <IconUsers size={20} />}
                {creating === 'duo' ? 'Setting the table…' : 'New with a friend'}
              </button>
            </div>
            <form className="quick-join" onSubmit={join}>
              <label htmlFor="home-code">Got a code?</label>
              <div className="quick-join-row">
                <input
                  id="home-code"
                  className="code-input code-input-small"
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value.toUpperCase());
                    setCodeError(null);
                  }}
                  placeholder="K7QP"
                  maxLength={8}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  inputMode="text"
                  aria-invalid={Boolean(codeError)}
                />
                <button className="button button-ghost" type="submit">
                  Join <IconArrow size={17} />
                </button>
              </div>
              {codeError && <p className="field-error">{codeError}</p>}
            </form>

            {error && (
              <div className="inline-error" role="alert">
                {error}
              </div>
            )}

          </div>

          <div className="hero-art" aria-hidden="true">
            <div className="hero-board-wrap">
              <div className="hero-board">
                {HERO_TILES.map((tile, index) => (
                  <span
                    key={index}
                    className={`mini-tile mini-${tile.state}`}
                    data-n={tile.n ?? ''}
                  >
                    {tile.state === 'flag' ? '🚩' : tile.state === 'mine' ? '💥' : tile.n || ''}
                  </span>
                ))}
              </div>
              <span className="hero-cursor hero-cursor-a">
                <span className="cursor-arrow" /> 🦦 Maya
              </span>
              <span className="hero-cursor hero-cursor-b">
                <span className="cursor-arrow" /> 🐈 Sam
              </span>
            </div>
            <div className="hero-caption">
              <StatusPill tone="live">LIVE</StatusPill>
              <span>2 lives · 40 mines · 4:32</span>
            </div>
          </div>
        </section>

        <section className="game-picker" id="games">
          <div className="section-heading">
            <span className="eyebrow">Pick a table</span>
            <h2>Four games. One room.</h2>
            <p>Tap any game and it opens a lobby with that game already selected.</p>
          </div>
          <div className="game-card-grid">
            {GAME_ORDER.map((game) => {
              const meta = GAME_META[game];
              const busy = creating === game;
              return (
                <button
                  key={game}
                  type="button"
                  className={`game-card game-card-${game}`}
                  onClick={() => void create('game', game)}
                  disabled={Boolean(creating)}
                >
                  <span className="game-card-top">
                    <span className="game-card-icon">
                      <GameIcon game={game} size={24} />
                    </span>
                    <span className="game-card-kicker">{meta.kicker}</span>
                  </span>
                  <strong>{meta.label}</strong>
                  <span className="game-card-blurb">{meta.blurb}</span>
                  <span className="game-card-cta">
                    {busy ? <Spinner label={`Creating ${meta.label} lobby`} /> : null}
                    {busy ? 'Opening lobby…' : 'Create lobby'}
                    {!busy && <IconArrow size={15} />}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <Logo small />
      </footer>
    </div>
  );
}
