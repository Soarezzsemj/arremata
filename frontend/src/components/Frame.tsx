import type { ReactNode } from 'react';

export function Corners({ className = '', size = 'size-3' }: { className?: string; size?: string }) {
  const mark = `absolute ${size} border-current`;
  return (
    <span aria-hidden="true" className={`pointer-events-none absolute inset-0 ${className}`}>
      <span className={`${mark} left-0 top-0 border-l border-t`} />
      <span className={`${mark} right-0 top-0 border-r border-t`} />
      <span className={`${mark} bottom-0 left-0 border-b border-l`} />
      <span className={`${mark} bottom-0 right-0 border-b border-r`} />
    </span>
  );
}

export function Frame({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      {children}
      <Corners />
    </div>
  );
}
