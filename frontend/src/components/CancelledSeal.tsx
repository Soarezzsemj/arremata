export function CancelledSeal({ className = '' }: { className?: string }) {
  return (
    <span className={`ui-label inline-flex items-center gap-2 whitespace-nowrap border border-gray px-2 py-1 text-muted ${className}`}>
      <span aria-hidden="true" className="size-2 bg-gray" />
      Leilão cancelado
    </span>
  );
}
