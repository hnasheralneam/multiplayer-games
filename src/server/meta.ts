const DEFAULT_TITLE = 'Games, together';
const DEFAULT_DESCRIPTION =
  'One room, one link. Minesweeper, Sudoku, Klondike, FreeCell, and the people around you. No signup, no chat.';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export interface MetaOptions {
  title?: string;
  description?: string;
  url?: string;
  image?: string;
  roomCode?: string;
}

export function injectMeta(html: string, options: MetaOptions = {}): string {
  const title = options.title ?? DEFAULT_TITLE;
  const description = options.description ?? DEFAULT_DESCRIPTION;
  const tags = [
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Games, together" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    options.url ? `<meta property="og:url" content="${escapeHtml(options.url)}" />` : '',
    options.image ? `<meta property="og:image" content="${escapeHtml(options.image)}" />` : '',
    options.image ? `<meta property="og:image:width" content="1200" />` : '',
    options.image ? `<meta property="og:image:height" content="630" />` : '',
    `<meta name="twitter:card" content="${options.image ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    options.image ? `<meta name="twitter:image" content="${escapeHtml(options.image)}" />` : '',
    options.roomCode ? `<meta name="ms:room" content="${escapeHtml(options.roomCode)}" />` : ''
  ]
    .filter(Boolean)
    .join('\n    ');

  return html
    .replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(title)}</title>`)
    .replace('<!--OG-->', tags);
}

export const defaultTitle = DEFAULT_TITLE;
export const defaultDescription = DEFAULT_DESCRIPTION;
