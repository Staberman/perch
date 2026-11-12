import type { SessionState } from "../domain/appearance.ts";

export interface Perched {
  character: string;
  color: string;
  /** The moods it takes turns with, a few seconds each. */
  states: readonly SessionState[];
}

export const perched: readonly Perched[] = [
  { character: "robot", color: "#3ccfe6", states: ["working", "working", "done", "sleeping"] },
  { character: "default", color: "#d97757", states: ["idle", "needsInput", "working", "working"] },
  { character: "cat", color: "#ff5fa2", states: ["sleeping", "sleeping", "idle", "done"] },
  { character: "ghost", color: "#a66cff", states: ["working", "compacting", "working", "idle"] },
  { character: "default", color: "#ffd23f", states: ["done", "idle", "needsPermission", "working"] },
  { character: "cat", color: "#e8e8e8", states: ["idle", "working", "sleeping", "sleeping"] },
  { character: "robot", color: "#4cd964", states: ["needsInput", "working", "working", "done"] },
];
