export function Square({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-2 shrink-0 bg-current transition-colors duration-150 group-hover:bg-accent ${className}`}
    />
  );
}
