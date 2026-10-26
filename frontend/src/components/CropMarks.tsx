import { Corners } from './Frame';


export function CropMarks() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-2 z-50 text-snow mix-blend-difference md:inset-3">
      <Corners size="size-3 md:size-4" />
      {}
      <span className="absolute left-0 top-1/2 hidden h-3 w-px -translate-y-1/2 bg-current md:block" />
      <span className="absolute left-0 top-1/2 hidden h-px w-2.5 bg-current md:block" />
      <span className="absolute right-0 top-1/2 hidden h-3 w-px -translate-y-1/2 bg-current md:block" />
      <span className="absolute right-0 top-1/2 hidden h-px w-2.5 bg-current md:block" />
    </div>
  );
}
