import type { Agent, SessionState } from "../domain/appearance.ts";

export interface Feature {
  title: string;
  /** HTML: may hold <b> and <code>. */
  text: string;
  creature: { character: string; color: string; state: SessionState; agent?: Agent };
}

export const features: readonly Feature[] = [
  {
    title: "Claude Code and Codex, side by side",
    text: "Sessions of Claude Code and of OpenAI's Codex, CLI or app, share the strip. A badge in each creature's corner tells them apart: a spark for Claude, <code>&gt;_</code> for Codex.",
    creature: { character: "robot", color: "#3ccfe6", state: "working", agent: "codex" },
  },
  {
    title: "Pin the ones you care about",
    text: "The <b>+</b> opens a Claude and a Codex tab with every session, running or stopped. Type to find one by name or folder. The rest show up only while they work or need you.",
    creature: { character: "default", color: "#a66cff", state: "compacting" },
  },
  {
    title: "Hover for the details",
    text: "Each creature tells you its session's name, its agent and what it's doing, like <code>Bash: npm test</code> or <code>done · 5m</code>.",
    creature: { character: "ghost", color: "#4f7cff", state: "needsInput" },
  },
  {
    title: "Click to jump in",
    text: "Opens the session where it lives: the Claude or Codex app, or its Terminal tab, even one that has already stopped. The one in front wears a white ring.",
    creature: { character: "cat", color: "#ff5fa2", state: "done" },
  },
  {
    title: "Never in the way",
    text: "Floats over every Space and full-screen app and never takes focus. Tuck it off the edge with its tab, which still blinks when you're needed, or hide it from the menu bar.",
    creature: { character: "default", color: "#ffd23f", state: "sleeping" },
  },
  {
    title: "Light as a petal",
    text: "A native AppKit and Core Animation app with no Dock icon: about 0.5% of one CPU core and 13 MB of memory while it animates.",
    creature: { character: "ghost", color: "#4cd964", state: "idle" },
  },
];
