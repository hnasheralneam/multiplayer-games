import type { ReactNode } from 'react';
import { Link } from '../lib/router';
import { Logo, Spinner } from './ui';

export function StateScreen({
  logo = false,
  spinner = false,
  eyebrow,
  title,
  body,
  hint,
  error,
  actions,
  home = false
}: {
  logo?: boolean;
  spinner?: boolean;
  eyebrow?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  hint?: string;
  error?: string | null;
  actions?: ReactNode;
  home?: boolean;
}) {
  return (
    <div className="center-page">
      <div className="center-card">
        {logo && <Logo />}
        {spinner && <Spinner label="Loading" />}
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {body && <p>{body}</p>}
        {hint && <p className="center-hint">{hint}</p>}
        {error && (
          <div className="inline-error" role="alert">
            {error}
          </div>
        )}
        {actions && <div className="center-actions">{actions}</div>}
        {home && (
          <Link className="center-home" to="/">
            Back home
          </Link>
        )}
      </div>
    </div>
  );
}
