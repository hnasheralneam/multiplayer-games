import type { GameKind } from '../../shared/types';
import { IconFreeCell, IconKlondike, IconMahjong, IconMine, IconSudoku } from './icons';

export function GameIcon({ game, size = 20 }: { game: GameKind; size?: number }) {
  switch (game) {
    case 'sudoku':
      return <IconSudoku size={size} />;
    case 'klondike':
      return <IconKlondike size={size} />;
    case 'freecell':
      return <IconFreeCell size={size} />;
    case 'mahjong':
      return <IconMahjong size={size} />;
    default:
      return <IconMine size={size} />;
  }
}
