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
    <path d="M4 2.5v11a.5.5 0 0 0 .77.42l8.5-5.5a.5.5 0 0 0 0-.84l-8.5-5.5A.5.5 0 0 0 4 2.5z" />
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
