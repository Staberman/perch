/**
 * Follows which session is in front in Terminal.app: every couple of seconds, one osascript call asks
 * for the tty of the selected tab of the front window, only if Terminal is running and frontmost.
 * That tty is mapped to a live session through the pid the CLI recorded in ~/.claude/sessions.
 */
import { homedir } from "node:os";
import { isAlive, processTty, sessionPids } from "./open-session.ts";

// `is running` is asked outside any `tell`, so asking never launches Terminal; and without System Events
// there is no Accessibility prompt. An empty answer means "nothing of ours in front".
const FRONT_TTY = `if application "Terminal" is not running then return ""
tell application "Terminal"
	if not frontmost then return ""
	try
		return tty of selected tab of front window
	on error
		return ""
	end try
end tell`;

export interface TerminalFocusOptions {
  intervalMs?: number;
  /** After a failed osascript call, how long to wait before trying again. */
  backoffMs?: number;
  /** Polled each tick; false pauses the watcher, e.g. while the desktop app is the focus source. */
  enabled?: () => boolean;
  /** Returns the front tab's tty like "/dev/ttys003", or "" when Terminal isn't in front. Replaceable for tests. */
  run?: () => Promise<string>;
  /** Maps a tty to the live session on it. */
  sessionForTty?: (tty: string) => Promise<string | null>;
  log?: (message: string) => void;
}

async function runFrontTty(): Promise<string> {
  const proc = Bun.spawn(["osascript", "-e", FRONT_TTY], { stdout: "pipe", stderr: "pipe" });
  // A beachballed Terminal would hold the AppleEvent for about 2 minutes; give up sooner and back off.
  const timer = setTimeout(() => proc.kill(), 10_000);
  const [out, err, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]).finally(() =>
    clearTimeout(timer),
  );
  if (code !== 0) throw new Error(`osascript exited with ${code}${err.trim() ? `: ${err.trim().slice(0, 200)}` : ""}`);
  return out.trim();
}

/** pid → tty never changes for a process, so ps runs once per session. */
export function ttyResolver({
  pids = () => sessionPids(`${homedir()}/.claude/sessions`),
  ttyOf = processTty,
  alive = isAlive,
}: {
  pids?: () => Promise<Map<string, number>>;
  ttyOf?: (pid: number) => Promise<string | undefined>;
  alive?: (pid: number) => boolean;
} = {}) {
  const ttys = new Map<number, string>();
  return async (tty: string): Promise<string | null> => {
    const current = await pids();
    const seen = new Set(current.values());
    for (const pid of ttys.keys()) if (!seen.has(pid)) ttys.delete(pid); // gone, or its pid may be reused
    for (const [id, pid] of current) {
      if (!alive(pid)) continue;
      if (!ttys.has(pid)) {
        const found = await ttyOf(pid); // a failed lookup isn't cached, so the next tick retries it
        if (found) ttys.set(pid, found);
      }
      if (tty === `/dev/${ttys.get(pid)}`) return id;
    }
    return null;
  };
}

/** Calls `onFocus` with the session in front in Terminal.app, or null; only when that changes. Returns a stop function. */
export function watchTerminalFocus(
  onFocus: (sessionId: string | null) => void,
  {
    intervalMs = 2000,
    backoffMs = 60_000,
    enabled = () => true,
    run = runFrontTty,
    sessionForTty = ttyResolver(),
    log = (message) => console.error(message),
  }: TerminalFocusOptions = {},
) {
  let stopped = false;
  let last: string | null | undefined;
  let failing = false;

  (async () => {
    while (!stopped) {
      let wait = intervalMs;
      if (enabled()) {
        try {
          const tty = await run();
          const id = tty ? await sessionForTty(tty) : null;
          if (id !== last) {
            last = id;
            onFocus(id);
          }
          failing = false;
        } catch (error) {
          if (!failing) log(`terminal focus failing, retrying every ${backoffMs / 1000}s: ${error instanceof Error ? error.message : String(error)}`);
          failing = true;
          wait = backoffMs;
        }
      }
      await Bun.sleep(wait);
    }
  })();

  return () => {
    stopped = true;
  };
}
