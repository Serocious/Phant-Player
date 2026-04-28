import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
}

/**
 * Minimal SVG icons used throughout the player UI. All icons are designed
 * for currentColor — control colour from CSS.
 */

export const PlayIcon: React.FC<IconProps> = ({ size = 14, className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="currentColor">
    {/* Slightly nudged right (x starts at 4.5 not 4) so the triangle's
        visual centre lines up with the geometric centre of the icon. */}
    <path d="M4.5 2.5v11a.5.5 0 0 0 .77.42l8.2-5.5a.5.5 0 0 0 0-.84l-8.2-5.5A.5.5 0 0 0 4.5 2.5z" />
  </svg>
);

export const PauseIcon: React.FC<IconProps> = ({ size = 14, className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="currentColor">
    <rect x="3.5" y="2" width="3" height="12" rx="0.8" />
    <rect x="9.5" y="2" width="3" height="12" rx="0.8" />
  </svg>
);

export const PrevIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="currentColor">
    <rect x="2.5" y="3" width="1.6" height="10" rx="0.6" />
    <path d="M14 3.4v9.2a.4.4 0 0 1-.62.34l-7-4.6a.4.4 0 0 1 0-.68l7-4.6A.4.4 0 0 1 14 3.4z" />
  </svg>
);

export const NextIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="currentColor">
    <rect x="11.9" y="3" width="1.6" height="10" rx="0.6" />
    <path d="M2 3.4v9.2a.4.4 0 0 0 .62.34l7-4.6a.4.4 0 0 0 0-.68l-7-4.6A.4.4 0 0 0 2 3.4z" />
  </svg>
);

export const VolumeIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="currentColor">
    <path d="M7.4 2.2L4 5H1.5a.5.5 0 0 0-.5.5v5a.5.5 0 0 0 .5.5H4l3.4 2.8a.5.5 0 0 0 .8-.4V2.6a.5.5 0 0 0-.8-.4z" />
    <path d="M11 5.5a3 3 0 0 1 0 5" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    <path d="M12.5 3a5.5 5.5 0 0 1 0 10" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
  </svg>
);

export const AlbumsIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.4">
    <rect x="2" y="2" width="5" height="5" rx="0.8" />
    <rect x="9" y="2" width="5" height="5" rx="0.8" />
    <rect x="2" y="9" width="5" height="5" rx="0.8" />
    <rect x="9" y="9" width="5" height="5" rx="0.8" />
  </svg>
);

export const SongsIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <path d="M2 4h12M2 8h12M2 12h8" />
  </svg>
);

export const ArtistsIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.4">
    <circle cx="8" cy="6" r="2.6" />
    <path d="M3 13.5c.7-2.6 2.7-4 5-4s4.3 1.4 5 4" strokeLinecap="round" />
  </svg>
);

export const RescanIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" />
    <path d="M13.5 2.5v3.5h-3.5" />
  </svg>
);

export const SettingsIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.4">
    <circle cx="8" cy="8" r="2" />
    <path d="M8 1.5v2M8 12.5v2M14.5 8h-2M3.5 8h-2M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4M12.6 12.6l-1.4-1.4M4.8 4.8L3.4 3.4" strokeLinecap="round" />
  </svg>
);

export const ChevronLeftIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 3l-5 5 5 5" />
  </svg>
);

export const ChevronDownIcon: React.FC<IconProps> = ({ size = 12, className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6l5 5 5-5" />
  </svg>
);

export const ShuffleIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 4h2.5l2 3M14 4l-2 1.5M14 4l-2-1.5M14 4h-2.5l-7 8H2" />
    <path d="M14 12l-2 1.5M14 12l-2-1.5M14 12h-2.5l-2-3" />
  </svg>
);

export const RepeatIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3.5 6V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-9" />
    <path d="M5 12L2.5 9.5 5 7" />
  </svg>
);

export const RepeatOneIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    {/* Loop arrow, slightly shifted left to make room for the "1" */}
    <path d="M2.5 7V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H1.5" transform="translate(0.5 0)" />
    <path d="M4.5 13L2 10.5 4.5 8" />
    {/* "1" badge top-right, drawn as filled circle + number */}
    <circle cx="13" cy="3.5" r="2.6" fill="currentColor" stroke="none" />
    <text
      x="13"
      y="5"
      fontSize="4.2"
      fontWeight="800"
      fill="var(--bg-base)"
      stroke="none"
      textAnchor="middle"
      fontFamily="system-ui, sans-serif"
    >1</text>
  </svg>
);

export const QueueIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 4h10M3 8h10M3 12h7" />
    <path d="M13 12l2 1.5L13 15" fill="currentColor" stroke="none" />
  </svg>
);

export const PlusIcon: React.FC<IconProps> = ({ size = 14, className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <path d="M8 3v10M3 8h10" />
  </svg>
);

export const CloseIcon: React.FC<IconProps> = ({ size = 14, className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);

export const HeartIcon: React.FC<IconProps> = ({ size = 14, className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 13.5s-5-3-5-7a3 3 0 0 1 5-2.2A3 3 0 0 1 13 6.5c0 4-5 7-5 7z" />
  </svg>
);

export const HeartFilledIcon: React.FC<IconProps> = ({ size = 14, className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="currentColor">
    <path d="M8 13.5s-5-3-5-7a3 3 0 0 1 5-2.2A3 3 0 0 1 13 6.5c0 4-5 7-5 7z" />
  </svg>
);

export const InfoIcon: React.FC<IconProps> = ({ size = 14, className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="8" r="6" />
    <path d="M8 7v4" />
    <circle cx="8" cy="5" r="0.4" fill="currentColor" stroke="none" />
  </svg>
);
