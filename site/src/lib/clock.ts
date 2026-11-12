/**
 * The one animation clock every creature on the page shares. It ticks four times a second, like the
 * overlay's, pauses while the tab is hidden, and holds still for people who prefer reduced motion.
 */
type Tick = (frame: number) => void;

const FRAME_MS = 250;
const subscribers = new Set<Tick>();
let frame = 1;
let timer: ReturnType<typeof setInterval> | undefined;

export const prefersReducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export const currentFrame = () => frame;

function tick() {
  if (document.hidden) return;
  frame++;
  for (const subscriber of subscribers) subscriber(frame);
}

/** Calls `tick` on every frame until the returned function is called. */
export function onFrame(subscriber: Tick): () => void {
  subscribers.add(subscriber);
  if (!timer && !prefersReducedMotion()) timer = setInterval(tick, FRAME_MS);
  return () => {
    subscribers.delete(subscriber);
    if (subscribers.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

export const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
