import type { PublicPlayer, You } from '../../shared/types';
import { Avatar } from './ui';
import { IconCrown } from './icons';

export function PlayerStrip({ players, you }: { players: PublicPlayer[]; you: You }) {
  return (
    <div className="players-strip" aria-label="Players in this round">
      {players.map((player) => (
        <div
          className={`strip-player ${player.connected ? '' : 'strip-player-offline'}`}
          key={player.id}
        >
          <Avatar
            avatar={player.avatar}
            color={player.color}
            size={26}
            connected={player.connected}
          />
          <span className="strip-name">
            {player.name}
            {player.id === you.id ? ' (you)' : ''}
          </span>
          {player.isHost && (
            <span className="strip-host" title="Host">
              <IconCrown size={12} />
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
