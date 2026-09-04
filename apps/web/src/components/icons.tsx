import type { SVGProps } from 'react';

/**
 * Inline stroke icons (zero-dependency). All inherit `currentColor` and a
 * 1.75 stroke; size via `className` (default 24px through width/height props).
 */
type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps) {
  return {
    width: 24,
    height: 24,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    ...props,
  };
}

export const HomeIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
    <path d="M9.5 21v-6h5v6" />
  </svg>
);

export const DumbbellIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6.5 6.5 17.5 17.5" />
    <path d="M4 8 2.5 9.5 4 11" transform="rotate(45 5 9)" />
    <rect x="2.2" y="6.6" width="3.2" height="6.8" rx="1" transform="rotate(45 3.8 10)" />
    <rect x="18.6" y="10.6" width="3.2" height="6.8" rx="1" transform="rotate(45 20.2 14)" />
  </svg>
);

export const ListIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M8 6h12M8 12h12M8 18h12" />
    <circle cx="4" cy="6" r="1" />
    <circle cx="4" cy="12" r="1" />
    <circle cx="4" cy="18" r="1" />
  </svg>
);

export const SparklesIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15l-1.8-4.2L5.5 9l4.7-1.3L12 3Z" />
    <path d="M19 14l.9 2.1 2.1.9-2.1.9L19 20l-.9-2.1-2.1-.9 2.1-.9L19 14Z" />
  </svg>
);

export const UtensilsIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 3v7a2 2 0 0 0 4 0V3M7 10v11" />
    <path d="M17 3c-1.5 0-3 1.8-3 5 0 2.2 1.2 3.4 2 3.8V21" />
  </svg>
);

export const ChartIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 20V4" />
    <path d="M4 20h16" />
    <rect x="7" y="12" width="3" height="5" rx="0.6" />
    <rect x="12" y="8" width="3" height="9" rx="0.6" />
    <rect x="17" y="5" width="3" height="12" rx="0.6" />
  </svg>
);

export const UserIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
  </svg>
);

export const ChevronRightIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export const ArrowLeftIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </svg>
);

export const CheckIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m5 12 5 5L20 7" />
  </svg>
);

export const PlusIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const FlameIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3c1 3-2 4-2 7a2 2 0 0 0 4 0c2 1.5 3 3.5 3 5.5a5 5 0 0 1-10 0c0-3.5 3-4.5 5-12.5Z" />
  </svg>
);

export const BellIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
    <path d="M10 19a2 2 0 0 0 4 0" />
  </svg>
);

export const CameraIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13" r="3.2" />
  </svg>
);

export const GoogleIcon = (p: IconProps) => (
  <svg width={20} height={20} viewBox="0 0 24 24" {...p}>
    <path
      fill="#4285F4"
      d="M22.5 12.2c0-.7-.06-1.4-.18-2.06H12v3.9h5.9a5.05 5.05 0 0 1-2.19 3.32v2.76h3.54c2.07-1.9 3.25-4.72 3.25-7.92Z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.94 0 5.42-.97 7.22-2.64l-3.54-2.76c-.98.66-2.24 1.05-3.68 1.05-2.83 0-5.23-1.91-6.09-4.48H2.26v2.85A11 11 0 0 0 12 23Z"
    />
    <path
      fill="#FBBC05"
      d="M5.91 14.17a6.6 6.6 0 0 1 0-4.34V6.98H2.26a11 11 0 0 0 0 10.04l3.65-2.85Z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.6 0 3.03.55 4.16 1.62l3.12-3.12C17.42 2.1 14.94 1 12 1A11 11 0 0 0 2.26 6.98l3.65 2.85C6.77 7.3 9.17 5.38 12 5.38Z"
    />
  </svg>
);
