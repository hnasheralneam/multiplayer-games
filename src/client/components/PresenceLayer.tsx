import { useRemoteCursors } from '../lib/cursors';
import type { CSSProperties } from 'react';

export function PresenceLayer() {
  const cursors = useRemoteCursors();
  return (
    <div className="presence-layer" aria-hidden="true">
      {cursors.map((cursor) => (
        <div
          className="remote-cursor"
          key={cursor.id}
          style={
            {
              left: `${cursor.x * 100}%`,
              top: `${cursor.y * 100}%`,
              '--c': cursor.color
            } as CSSProperties
          }
        >
          <svg viewBox="0 0 16 16" className="remote-cursor-arrow">
            <path d="M2 1.5 13.5 8 8.3 9.4 6.1 14.5 2 1.5Z" fill="currentColor" />
          </svg>
          <span className="remote-cursor-label">
            {cursor.avatar} {cursor.name}
          </span>
        </div>
      ))}
    </div>
  );
}
