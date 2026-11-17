import { HOOK_PORT } from "./config.ts";

/** Hook events the agent needs to track session state. */
export const PANEL_EVENTS = [
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "Notification",
  "Stop",
  "StopFailure",
  "SubagentStart",
  "SubagentStop",
  "PreCompact",
  "PostCompact",
  "SessionEnd",
] as const;

/**
 * The events Codex hooks report, as Codex 0.146 knows them. Codex has no Notification: a permission prompt
 * is PermissionRequest. Interrupt is left out until the Codex releases people run all know it.
 */
export const CODEX_EVENTS = [
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "PermissionRequest",
  "PostToolUse",
  "Stop",
  "SubagentStart",
  "SubagentStop",
  "PreCompact",
  "PostCompact",
  "SessionEnd",
] as const;

export const HOOK_URL = `http://127.0.0.1:${HOOK_PORT}/hook`;
export const CODEX_HOOK_URL = `${HOOK_URL}/codex`;
/** Header the Codex hook sets to the pid of the process that ran it: Codex reports no pid of its own. */
export const PID_HEADER = "X-Tomari-Pid";

export type HookTarget = "claude" | "codex";

/**
 * The `hooks` block for Claude Code's settings.json, or for Codex's hooks.json (the same shape), forwarding
 * every event to the agent.
 *
 * A command hook with curl rather than `"type": "http"`: when the agent is down,
 * http hooks add a "hook error" to the transcript of every session, while
 * `curl … || true` stays silent. Hooks stay synchronous so events arrive in order. Codex runs the
 * command through a shell, so `$PPID` there is the Codex process: the agent tells it is alive by it.
 */
export function buildPanelHooks(target: HookTarget = "claude") {
  const command =
    target === "codex"
      ? `/usr/bin/curl -s -m 1 -H 'Content-Type: application/json' -H "${PID_HEADER}: $PPID" --data-binary @- ${CODEX_HOOK_URL} >/dev/null 2>&1 || true`
      : `/usr/bin/curl -s -m 1 -H 'Content-Type: application/json' --data-binary @- ${HOOK_URL} >/dev/null 2>&1 || true`;
  const events = target === "codex" ? CODEX_EVENTS : PANEL_EVENTS;
  return Object.fromEntries(events.map((event) => [event, [{ hooks: [{ type: "command", command, timeout: 2 }] }]]));
}

/** True for handlers installed by this project, including the earlier `http` variant. */
export function isPanelHook(handler: { type?: string; url?: string; command?: unknown }) {
  if (handler.type === "http") return handler.url === HOOK_URL;
  return handler.type === "command" && typeof handler.command === "string" && handler.command.includes(HOOK_URL);
}

type Handler = { type?: string; url?: string; command?: unknown; [k: string]: unknown };
type MatcherGroup = { matcher?: string; hooks: Handler[] };
export type Settings = { hooks?: Record<string, MatcherGroup[]>; [k: string]: unknown };

/** `settings` with our hooks removed, then added back when `install`; everything else stays as it was. */
export function mergeHooks(settings: Settings, { install, target = "claude" }: { install: boolean; target?: HookTarget }): Settings {
  const hooks: Record<string, MatcherGroup[]> = {};
  for (const [event, groups] of Object.entries(settings.hooks ?? {})) {
    const kept = groups
      .map((group) => ({ ...group, hooks: group.hooks.filter((h) => !isPanelHook(h)) }))
      .filter((group) => group.hooks.length > 0);
    if (kept.length > 0) hooks[event] = kept;
  }
  if (install) {
    for (const [event, groups] of Object.entries(buildPanelHooks(target))) hooks[event] = [...(hooks[event] ?? []), ...groups];
  }
  const { hooks: _, ...rest } = settings;
  return Object.keys(hooks).length > 0 ? { ...rest, hooks } : rest;
}

export function hasPanelHooks(settings: Settings) {
  return Object.values(settings.hooks ?? {}).some((groups) => groups.some((group) => group.hooks.some(isPanelHook)));
}
