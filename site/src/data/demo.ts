import type { SessionState } from "../domain/appearance.ts";

export interface DemoSession {
  id: string;
  name: string;
  character: string;
  color: string;
  state: SessionState;
  activity?: string;
  /** How long ago it reached its state, for its status line. */
  ago?: string;
  prompt: string;
  /** The two answers its window offers when it asks you something: the second is the one you pick. */
  choices?: readonly [string, string];
}

export const permissionChoices = ["Deny", "Allow"] as const;

/** What the hero's pretend desktop starts with; the first session is the one in front. */
export const demoSessions: readonly DemoSession[] = [
  { id: "web", name: "landing-page", character: "default", color: "#d97757", state: "working", activity: "Edit: Hero.astro", prompt: "Make the hero feel calmer" },
  { id: "auth", name: "fix-auth", character: "ghost", color: "#4f7cff", state: "working", activity: "Read: session.ts", prompt: "Why do tokens expire early?" },
  { id: "api", name: "api-server", character: "robot", color: "#3ccfe6", state: "working", activity: "Bash: npm test", prompt: "Make the flaky checkout test pass", choices: ["jest", "vitest"] },
  { id: "docs", name: "docs", character: "cat", color: "#a66cff", state: "working", activity: "Write: README.md", prompt: "Document the new CLI flags" },
  { id: "db", name: "refactor-db", character: "default", color: "#4cd964", state: "sleeping", ago: "2h", prompt: "Split the orders table" },
];

/** Where the pretend cursor can go: a session's creature, or the main button of the open session's question. */
export type CursorTarget = { session: string } | "answer" | "rest";

export type DemoStep =
  | { do: "pause"; ms: number }
  | { do: "state"; session: string; state: SessionState; activity?: string }
  | { do: "point"; at: CursorTarget }
  | { do: "hover"; session: string }
  | { do: "unhover" }
  | { do: "click"; at: CursorTarget }
  | { do: "open"; session: string };

/** One loop of the replay: a session asks for permission and you let it through, then another asks you a question. */
export const demoScript: readonly DemoStep[] = [
  { do: "point", at: "rest" },
  { do: "pause", ms: 1600 },
  { do: "state", session: "auth", state: "needsPermission", activity: "Bash: git push origin fix-auth" },
  { do: "pause", ms: 1400 },
  { do: "point", at: { session: "auth" } },
  { do: "pause", ms: 1000 },
  { do: "hover", session: "auth" },
  { do: "pause", ms: 1300 },
  { do: "click", at: { session: "auth" } },
  { do: "unhover" },
  { do: "open", session: "auth" },
  { do: "pause", ms: 800 },
  { do: "point", at: "answer" },
  { do: "pause", ms: 1100 },
  { do: "click", at: "answer" },
  { do: "state", session: "auth", state: "working", activity: "Bash: git push origin fix-auth" },
  { do: "pause", ms: 1500 },
  { do: "state", session: "docs", state: "done" },
  { do: "pause", ms: 900 },
  { do: "state", session: "api", state: "needsInput", activity: "Which runner: vitest or jest?" },
  { do: "pause", ms: 1100 },
  { do: "point", at: { session: "docs" } },
  { do: "pause", ms: 1000 },
  { do: "hover", session: "docs" },
  { do: "pause", ms: 1300 },
  { do: "point", at: { session: "api" } },
  { do: "pause", ms: 500 },
  { do: "hover", session: "api" },
  { do: "pause", ms: 1400 },
  { do: "click", at: { session: "api" } },
  { do: "unhover" },
  { do: "open", session: "api" },
  { do: "pause", ms: 800 },
  { do: "point", at: "answer" },
  { do: "pause", ms: 1100 },
  { do: "click", at: "answer" },
  { do: "state", session: "api", state: "working", activity: "Bash: npx vitest run" },
  { do: "pause", ms: 1300 },
  { do: "state", session: "web", state: "compacting" },
  { do: "point", at: "rest" },
  { do: "pause", ms: 2200 },
  { do: "state", session: "web", state: "working", activity: "Edit: Hero.astro" },
  { do: "pause", ms: 2600 },
];

/** A still frame for people who prefer reduced motion. */
export const demoStill: readonly Extract<DemoStep, { do: "state" }>[] = [
  { do: "state", session: "auth", state: "needsPermission", activity: "Bash: git push origin fix-auth" },
  { do: "state", session: "docs", state: "done" },
];
