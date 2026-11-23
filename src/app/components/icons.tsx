import type { ReactNode } from 'react';

/** Hand-drawn 16 px line icons: 1.5 px stroke in currentColor, always decorative (aria-hidden). */
function Icon({ size = 16, children }: { size?: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export const UndoIcon = () => (
  <Icon>
    <path d="M5.5 3.5L2.5 6.5l3 3" />
    <path d="M2.5 6.5h7a3.5 3.5 0 010 7H7" />
  </Icon>
);

export const RedoIcon = () => (
  <Icon>
    <path d="M10.5 3.5l3 3-3 3" />
    <path d="M13.5 6.5h-7a3.5 3.5 0 000 7H9" />
  </Icon>
);

export const PlusIcon = () => (
  <Icon>
    <path d="M8 3.5v9M3.5 8h9" />
  </Icon>
);

export const ShuffleIcon = () => (
  <Icon>
    <path d="M2.5 4.5h2.2c1.4 0 2.2.7 3 2l1.6 3c.8 1.3 1.6 2 3 2h1.2" />
    <path d="M2.5 11.5h2.2c1 0 1.7-.4 2.3-1.1M9.3 5.6c.6-.7 1.3-1.1 2.3-1.1h1.9" />
    <path d="M12 2.5l1.8 2-1.8 2M12 9.5l1.8 2-1.8 2" />
  </Icon>
);

export const LockIcon = ({ open = false }: { open?: boolean }) => (
  <Icon size={14}>
    <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
    <path d={open ? 'M5.5 7V5a2.5 2.5 0 014.8-1' : 'M5.5 7V5a2.5 2.5 0 015 0v2'} />
  </Icon>
);

export const ChevronIcon = () => (
  <Icon size={12}>
    <path d="M4 6l4 4 4-4" />
  </Icon>
);

export const CloseIcon = () => (
  <Icon size={14}>
    <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
  </Icon>
);

export const LinkIcon = ({ broken = false }: { broken?: boolean }) => (
  <Icon>
    {broken ? null : <path d="M6.5 9.5l3-3" />}
    <path d="M7 4.5l1-1a2.8 2.8 0 014 4l-1 1" />
    <path d="M9 11.5l-1 1a2.8 2.8 0 01-4-4l1-1" />
  </Icon>
);

/** Arrow down into a tray: save the image. */
export const DownloadIcon = () => (
  <Icon>
    <path d="M8 2.5v7.5M4.8 7l3.2 3.2L11.2 7" />
    <path d="M2.5 11v1.5a1 1 0 001 1h9a1 1 0 001-1V11" />
  </Icon>
);

/** Open folder: load a settings file. A different silhouette from Export so they read apart at 16px. */
export const ImportIcon = () => (
  <Icon>
    <path d="M1.5 12.5V3.5a1 1 0 011-1h3.3l1.5 1.5h5.2a1 1 0 011 1V6" />
    <path d="M1.5 12.5l2-5.5h11l-2 5.5z" />
  </Icon>
);

/** Document with a bold arrow leaving upward: save a settings file. */
export const ExportIcon = () => (
  <Icon>
    <path d="M10 2.5H4a1 1 0 00-1 1v9a1 1 0 001 1h8a1 1 0 001-1V5.5" />
    <path d="M8 10.5V1.5M5.5 4L8 1.5 10.5 4" />
  </Icon>
);

/** Double chevron pointing apart: open every section. */
export const ExpandAllIcon = () => (
  <Icon size={12}>
    <path d="M5 6l3-3 3 3M5 10l3 3 3-3" />
  </Icon>
);

/** Double chevron pointing together: close every section. */
export const CollapseAllIcon = () => (
  <Icon size={12}>
    <path d="M5 3l3 3 3-3M5 13l3-3 3 3" />
  </Icon>
);
