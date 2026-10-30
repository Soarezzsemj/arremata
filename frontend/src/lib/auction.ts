export const ANTI_SNIPING_WINDOW_MS = 120_000;


export const FINAL_COUNTDOWN_MS = 15_000;

export type FinalStage = 'normal' | 'final' | 'one' | 'two' | 'three' | 'closing';

export function finalStage(remainingMs: number): FinalStage {
  if (remainingMs <= 0) return 'closing';
  if (remainingMs <= 3_000) return 'three';
  if (remainingMs <= 6_000) return 'two';
  if (remainingMs <= 10_000) return 'one';
  if (remainingMs <= FINAL_COUNTDOWN_MS) return 'final';
  return 'normal';
}
