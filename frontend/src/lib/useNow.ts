import { useEffect, useState } from 'react';
import { FINAL_COUNTDOWN_MS } from './auction';
import { serverNow, subscribeServerClock } from './serverClock';

const SLOW_TICK_MS = 1_000;
const FAST_TICK_MS = 100;

function nextDelay(now: number, deadlineMs: number | undefined) {
  if (deadlineMs === undefined) return SLOW_TICK_MS;
  const left = deadlineMs - now;
  if (left <= 0) return SLOW_TICK_MS;
  if (left <= FINAL_COUNTDOWN_MS) return FAST_TICK_MS;
  return Math.min(SLOW_TICK_MS, left - FINAL_COUNTDOWN_MS);
}

export function useNow(deadlineMs?: number): number {
  const [now, setNow] = useState(serverNow);

  useEffect(() => subscribeServerClock(() => setNow(serverNow())), []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const t = serverNow();
      setNow(t);
      timer = setTimeout(tick, nextDelay(t, deadlineMs));
    };
    tick();
    return () => clearTimeout(timer);
  }, [deadlineMs]);

  return now;
}
