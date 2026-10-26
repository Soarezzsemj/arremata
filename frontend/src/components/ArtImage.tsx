import { useState } from 'react';
import { artImageUrl, type ImageWidth } from '../lib/images';

type Props = {
  src: string | null;
  title: string;
  width: ImageWidth;
  className?: string;
  fallbackClassName?: string;
  loading?: 'lazy' | 'eager';
  fit?: 'cover' | 'contain';
};


export function ArtImage({ src, title, width, className = '', fallbackClassName = '', loading = 'lazy', fit = 'cover' }: Props) {
  
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) {
    return (
      <div
        role="img"
        aria-label={title}
        className={`@container flex items-center justify-center overflow-hidden bg-line text-muted ${className} ${fallbackClassName}`}
      >
        {}
        <span aria-hidden="true" className="ui-display text-[45cqmin] leading-none">
          {title.trim().charAt(0) || '?'}
        </span>
      </div>
    );
  }

  return (
    <img
      src={artImageUrl(src, width)}
      alt={title}
      referrerPolicy="no-referrer"
      loading={loading}
      onError={() => setFailedSrc(src)}
      className={`${fit === 'cover' ? 'object-cover' : 'object-contain'} ${className}`}
    />
  );
}
