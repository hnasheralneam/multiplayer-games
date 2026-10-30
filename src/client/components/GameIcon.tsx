import type { GameKind } from '../../shared/types';
import { IconFreeCell, IconKlondike, IconMine, IconSudoku } from './icons';

export function GameIcon({ game, size = 20 }: { game: GameKind; size?: number }) {
  switch (game) {
    case 'sudoku':
      return <IconSudoku size={size} />;
    case 'klondike':
      return <IconKlondike size={size} />;
    case 'freecell':
      return <IconFreeCell size={size} />;
    default:
      return <IconMine size={size} />;
  }
}
