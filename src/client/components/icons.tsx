import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 20, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...props
  };
}

export function IconMine(props: IconProps) {
  return (
    <svg {...base(props)} fill="currentColor" stroke="none">
      <circle cx="12" cy="12" r="5.2" />
      <path
        d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4M5.3 5.3l2.8 2.8M15.9 15.9l2.8 2.8M18.7 5.3l-2.8 2.8M8.1 15.9l-2.8 2.8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconSudoku(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2.4" />
      <path d="M9 3.5v17M15 3.5v17M3.5 9h17M3.5 15h17" />
      <path d="M5.4 7.1h2.2M10.9 12.9h2.2M16.4 5.4v2.2" strokeWidth="2.4" />
    </svg>
  );
}

export function IconKlondike(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="6.8" y="3.2" width="11.5" height="16.4" rx="2.2" transform="rotate(-9 12 12)" />
      <rect x="5.8" y="4.3" width="11.5" height="16.4" rx="2.2" />
      <path d="M11.5 8.4c1.3-.9 2.7-.3 2.7.9 0 1.5-2.7 3-2.7 3s-2.7-1.5-2.7-3c0-1.2 1.4-1.8 2.7-.9Z" fill="currentColor" stroke="none" />
      <path d="M11.5 13.2v3.5M10.2 15h2.6" strokeWidth="1.4" />
    </svg>
  );
}

export function IconFreeCell(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3.2" y="3.2" width="7.4" height="7.4" rx="1.7" />
      <rect x="13.4" y="3.2" width="7.4" height="7.4" rx="1.7" />
      <rect x="3.2" y="13.4" width="7.4" height="7.4" rx="1.7" />
      <rect x="13.4" y="13.4" width="7.4" height="7.4" rx="1.7" />
      <path d="m5.9 8.4 1.1-2 1.1 2M16 6.4h2.2v2.2" strokeWidth="1.5" />
    </svg>
  );
}

export function IconMahjong(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="8.4" y="2.8" width="12" height="12" rx="2.2" transform="rotate(12 14.4 8.8)" />
      <rect x="3.6" y="6.8" width="12.4" height="14.4" rx="2.2" />
      <circle cx="7.6" cy="11.4" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="12" cy="11.4" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="7.6" cy="15.4" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="12" cy="15.4" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="9.8" cy="18.6" r="1.15" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconFlag(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="3 2 18 20">
      <path d="M6 21.5V2.8" />
      <path
        d="M6 4.2c4.3-2.2 7.5 2.8 14.5.7v10.2c-7 2.1-10.2-2.9-14.5-.7Z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

export function IconHeart(props: IconProps) {
  return (
    <svg {...base(props)} fill="currentColor" stroke="none">
      <path d="M12 20.3S3.6 15.4 3.6 9.5A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 8.4 2.2c0 5.9-8.4 10.8-8.4 10.8Z" />
    </svg>
  );
}

export function IconCopy(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="9" y="9" width="11" height="11" rx="2.2" />
      <path d="M15 9V6.2A2.2 2.2 0 0 0 12.8 4H6.2A2.2 2.2 0 0 0 4 6.2v6.6A2.2 2.2 0 0 0 6.2 15H9" />
    </svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m4.5 12.5 5 5 10-11" />
    </svg>
  );
}

export function IconQR(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.2" />
      <rect x="14" y="3.5" width="6.5" height="6.5" rx="1.2" />
      <rect x="3.5" y="14" width="6.5" height="6.5" rx="1.2" />
      <path d="M14 14h2.5v2.5H14zM18 18h2.5v2.5H18zM14 20.5h2M20.5 14V11M11 3.5v2M3.5 11h2" />
    </svg>
  );
}

export function IconShare(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="18" cy="5" r="2.6" />
      <circle cx="6" cy="12" r="2.6" />
      <circle cx="18" cy="19" r="2.6" />
      <path d="m8.3 10.7 7.4-4.3M8.3 13.3l7.4 4.3" />
    </svg>
  );
}

export function IconGear(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.11a1.7 1.7 0 0 0-1.11-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.11a1.7 1.7 0 0 0 1.55-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.11a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.11a1.7 1.7 0 0 0-1.55 1Z" />
    </svg>
  );
}

export function IconCrown(props: IconProps) {
  return (
    <svg {...base(props)} fill="currentColor" stroke="none">
      <path d="m3 7 4 4 5-6 5 6 4-4-2 11H5L3 7Z" />
    </svg>
  );
}

export function IconArrow(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 12h15M13 5.5 19.5 12 13 18.5" />
    </svg>
  );
}

export function IconX(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5.5 5.5l13 13M18.5 5.5l-13 13" />
    </svg>
  );
}

export function IconUsers(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.2c.7-3.1 2.9-5 5.5-5s4.8 1.9 5.5 5" />
      <path d="M15.5 5.4a3 3 0 0 1 0 5.7M17 14.5c2.2.4 3.6 2 4.1 4.5" />
    </svg>
  );
}

export function IconLink(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M9.5 14.5 14.5 9.5M8 16.5l-1.4 1.4a3.5 3.5 0 0 1-5-5L5 9.5M16 7.5l1.4-1.4a3.5 3.5 0 0 1 5 5L19 14.5" />
    </svg>
  );
}

export function IconClock(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function IconSkull(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 11a7 7 0 1 1 14 0c0 2.1-.8 3.2-2 4.4V18a2 2 0 0 1-2 2h-2v-2h-2v2H9a2 2 0 0 1-2-2v-2.6C5.8 14.2 5 13.1 5 11Z" />
      <circle cx="9.3" cy="11" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="14.7" cy="11" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconSpark(props: IconProps) {
  return (
    <svg {...base(props)} fill="currentColor" stroke="none">
      <path d="M12 2.5c.4 4.7 1.8 6.1 6.5 6.5-4.7.4-6.1 1.8-6.5 6.5-.4-4.7-1.8-6.1-6.5-6.5 4.7-.4 6.1-1.8 6.5-6.5Z" />
      <path d="M19 14c.2 2.6 1 3.4 3.5 3.6-2.5.2-3.3 1-3.5 3.6-.2-2.6-1-3.4-3.5-3.6 2.5-.2 3.3-1 3.5-3.6Z" />
    </svg>
  );
}

export function IconSound(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 9.5v5h3.5L12 18V6L7.5 9.5H4Z" />
      <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
    </svg>
  );
}

export function IconMuted(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 9.5v5h3.5L12 18V6L7.5 9.5H4Z" />
      <path d="m16 9 5 6M21 9l-5 6" />
    </svg>
  );
}

export function IconRefresh(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M20 11a8 8 0 1 0-.6 4M20 4v7h-7" />
    </svg>
  );
}

export function IconEye(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function IconPlay(props: IconProps) {
  return (
    <svg {...base(props)} fill="currentColor" stroke="none">
      <path d="M7 4.8c0-.8.9-1.3 1.6-.9l11 6.4c.7.4.7 1.4 0 1.8l-11 6.4c-.7.4-1.6-.1-1.6-.9V4.8Z" />
    </svg>
  );
}

export function IconDice(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <circle cx="8.8" cy="8.8" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15.2" cy="15.2" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconChevron(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconSun(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.4v2.2M12 19.4v2.2M2.4 12h2.2M19.4 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6" />
    </svg>
  );
}

export function IconMoon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z" />
    </svg>
  );
}
