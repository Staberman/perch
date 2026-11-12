import type { SessionState } from "../domain/appearance.ts";

export interface Feature {
  title: string;
  /** HTML: may hold <b> and <code>. */
  text: string;
  creature: { character: string; color: string; state: SessionState };
}

export const features: readonly Feature[] = [
  {
    title: "Pin the ones you care about",
    text: "The <b>+</b> lists every session in the Claude desktop app, running or stopped. The rest show up only while they work or need you.",
    creature: { character: "robot", color: "#3ccfe6", state: "working" },
  },
  {
    title: "Hover for the details",
    text: "Each creature tells you its session's name and what it's doing, like <code>Bash: npm test</code> or <code>done · 5m</code>.",
    creature: { character: "ghost", color: "#4f7cff", state: "needsInput" },
  },
  {
    title: "Click to jump in",
    text: "Opens the session in the Claude desktop app, even one the app has already stopped. The one in front wears a white ring.",
    creature: { character: "cat", color: "#ff5fa2", state: "done" },
  },
  {
    title: "Never in the way",
    text: "Floats over every Space and full-screen app and never takes focus. Tuck it off the edge with its tab, which still blinks when you're needed.",
    creature: { character: "default", color: "#ffd23f", state: "sleeping" },
  },
  {
    title: "A menu bar companion",
    text: "Show or hide the strip, move it to the left or right edge, and see how many sessions are waiting for you.",
    creature: { character: "robot", color: "#a66cff", state: "compacting" },
  },
  {
    title: "Light as a petal",
    text: "A native AppKit and Core Animation app with no Dock icon: about 0.5% of one CPU core and 13 MB of memory while it animates.",
    creature: { character: "ghost", color: "#4cd964", state: "idle" },
  },
];
