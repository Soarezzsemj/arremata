import { useEffect, useRef, useState } from 'react';

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#*+/';
const DURATION = 300;
export function ScrambleText({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(text);

  useEffect(() => {
    setShown(text);
    const trigger = ref.current?.closest('a, button');
    if (!trigger) return;

    let frame = 0;
    function run() {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      cancelAnimationFrame(frame);
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / DURATION);
        const settled = Math.floor(progress * text.length);
        setShown(
          Array.from(text, (ch, i) =>
            i < settled || ch === ' ' ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
          ).join(''),
        );
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }

    trigger.addEventListener('mouseenter', run);
    trigger.addEventListener('focus', run);
    return () => {
      cancelAnimationFrame(frame);
      trigger.removeEventListener('mouseenter', run);
      trigger.removeEventListener('focus', run);
    };
  }, [text]);
  return (
    <span ref={ref}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">{shown}</span>
    </span>
  );
}
