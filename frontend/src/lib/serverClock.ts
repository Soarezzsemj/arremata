let offsetMs = 0;
const listeners = new Set<() => void>();

const MIN_CHANGE_MS = 50;

export function syncServerClock(serverTime: unknown, sentAt: number, receivedAt: number) {
  if (typeof serverTime !== 'string') return;
  const server = Date.parse(serverTime);
  if (Number.isNaN(server)) return;
  const next = server - (sentAt + receivedAt) / 2;
  if (Math.abs(next - offsetMs) < MIN_CHANGE_MS) return;
  offsetMs = next;
  listeners.forEach((listener) => listener());
}

export function serverNow(): number {
  return Date.now() + offsetMs;
}

export function subscribeServerClock(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
