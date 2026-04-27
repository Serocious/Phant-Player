import React from 'react';
import { HeartIcon, HeartFilledIcon } from './Icons';

interface Props {
  isFavourite: boolean;
  onToggle: () => void;
  size?: number;
  className?: string;
  title?: string;
  /** If true, button is invisible until hovered (used for table rows). */
  showOnHover?: boolean;
}

export const FavouriteButton: React.FC<Props> = ({
  isFavourite,
  onToggle,
  size = 14,
  className = '',
  title,
  showOnHover = false,
}) => {
  return (
    <button
      type="button"
      className={`favourite-btn ${isFavourite ? 'is-favourite' : ''} ${showOnHover ? 'show-on-hover' : ''} ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      title={title || (isFavourite ? 'Remove from favourites' : 'Add to favourites')}
      aria-label={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
    >
      {isFavourite ? <HeartFilledIcon size={size} /> : <HeartIcon size={size} />}
    </button>
  );
};
