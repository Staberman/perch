// A port of Sources/TomariCore/Appearance.swift and Status.swift: how a session looks on the strip.
import type { CharacterTemplate } from "./characters.ts";
import { grayscaled, outlined, spriteFrame, type Hex, type Mood, type Pixels } from "./sprite.ts";

export type SessionState =
  | "working"
  | "needsPermission"
  | "needsInput"
  | "compacting"
  | "done"
  | "sleeping"
  | "error"
  | "closed"
  | "idle";

interface StateInfo {
  mood: Mood;
  label: string;
  /** The session's process has stopped. */
  closed?: true;
}

export const states: Record<SessionState, StateInfo> = {
  working: { mood: "working", label: "working" },
  needsPermission: { mood: "alert", label: "needs permission" },
  needsInput: { mood: "asking", label: "asking you" },
  compacting: { mood: "compacting", label: "compacting" },
  done: { mood: "finished", label: "done" },
  sleeping: { mood: "sleeping", label: "asleep" },
  error: { mood: "error", label: "error" },
  closed: { mood: "sleeping", label: "closed", closed: true },
  idle: { mood: "idle", label: "idle" },
};

/** CSS colors, or null for none; borderWidth is in sprite pixels. */
export interface Tile {
  fill: string | null;
  border: string | null;
  borderWidth: number;
}

export interface Look {
  pixels: Pixels;
  tile: Tile;
  /** 0…1 */
  opacity: number;
}

const ACCENT = [255, 107, 26] as const;
const DANGER = [255, 77, 77] as const;
const READY = [76, 217, 100] as const;
const rgba = ([r, g, b]: readonly number[], alpha = 1) => `rgba(${r}, ${g}, ${b}, ${alpha})`;

export const needsAttention = (state: SessionState) => state === "needsPermission" || state === "needsInput";

/** Attention outranks focus. */
function tileFor(state: SessionState, frame: number, focused: boolean): Tile {
  const base: Tile = focused
    ? { fill: "rgba(255, 255, 255, 0.22)", border: "rgba(255, 255, 255, 0.75)", borderWidth: 0.75 }
    : { fill: null, border: null, borderWidth: 0.75 };
  switch (state) {
    case "needsPermission":
      return { fill: rgba(ACCENT, frame % 4 < 2 ? 1 : 0.25), border: rgba(ACCENT), borderWidth: 1 };
    case "needsInput":
      return { fill: rgba(ACCENT, frame % 8 < 4 ? 0.35 : 0.2), border: rgba(ACCENT), borderWidth: 1 };
    case "done":
      return { ...base, border: rgba(READY) };
    case "error":
      return { ...base, border: rgba(DANGER) };
    default:
      return base;
  }
}

export interface CreatureSpec {
  character: CharacterTemplate;
  color: Hex;
  state: SessionState;
  frame: number;
  focused?: boolean;
  /** Rings the whole creature in this color, so white marks still show on a light page. */
  outline?: Hex;
}

export function creatureLook({ character, color, state, frame, focused = false, outline }: CreatureSpec): Look {
  const info = states[state];
  let pixels = spriteFrame(character, color, info.mood, frame);
  if (needsAttention(state)) pixels = outlined(pixels);
  if (info.closed) pixels = grayscaled(pixels);
  if (outline) pixels = outlined(pixels, outline);
  return { pixels, tile: tileFor(state, frame, focused), opacity: info.closed ? 0.45 : 1 };
}

export interface SessionStatus {
  state: SessionState;
  activity?: string;
  /** How long ago it reached its state, as "5m". */
  ago?: string;
}

/** The second line of the hover label. */
export function statusLine({ state, activity, ago = "now" }: SessionStatus): string {
  switch (state) {
    case "working":
      return activity ?? "working";
    case "needsPermission":
      return "needs permission";
    case "needsInput":
      return activity ?? "waiting for you";
    case "error":
      return activity ? `error · ${activity}` : "error";
    case "done":
    case "sleeping":
      return `done · ${ago}`;
    case "idle":
      return `idle · ${ago}`;
    case "closed":
      return `closed · ${ago}`;
    case "compacting":
      return "compacting";
  }
}

export type StatusTone = "attention" | "ready" | "danger" | "plain";

export function statusTone(state: SessionState): StatusTone {
  if (needsAttention(state)) return "attention";
  if (state === "done") return "ready";
  if (state === "error") return "danger";
  return "plain";
}
