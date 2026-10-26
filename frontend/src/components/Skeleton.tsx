export function SkeletonLine({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`block h-3 animate-pulse bg-line ${className}`} />;
}

export function LotGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div role="status" aria-label="Carregando lotes" className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="p-3">
          <div className="aspect-[4/5] animate-pulse border border-line" />
          <SkeletonLine className="mt-4 w-10" />
          <SkeletonLine className="mt-3 h-5 w-4/5" />
          <SkeletonLine className="mt-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}
