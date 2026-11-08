/**
 * Opens a session in the Claude desktop app.
 * - Known to the app (running or stopped while idle): navigate with the undocumented
 *   `claude://code/continue?session=local_…`; the app restarts the session if needed.
 * - Unknown to the app and closed: `claude --desktop --resume <id>` (documented, CLI ≥ 2.1.285).
 * - Running in a terminal: brings the Terminal.app tab on its tty to the front. Without a tty it is
 *   refused, since resuming it would start a second process on the same conversation.
 */
import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { DESKTOP_SESSIONS_DIR, findDesktopSession } from "./desktop-sessions.ts";
import { isSessionId } from "./protocol-guard.ts";

const LOCAL_ID = /^local_[A-Za-z0-9-]{1,64}$/;
const LIVE_DIR = `${homedir()}/.claude/sessions`;
const TTY = /^ttys\d+$/;

// Takes the tty as argv so it is never interpolated into the script. The `try` skips
// Terminal windows without tabs, which fail with -1728 when asked for them.
const FOCUS_TERMINAL_TAB = `on run argv
	set target to item 1 of argv
	if application "Terminal" is not running then error "Terminal is not running"
	tell application "Terminal"
		repeat with w in windows
			set windowTabs to {}
			try
				set windowTabs to tabs of w
			end try
			repeat with t in windowTabs
				if tty of t is target then
					set miniaturized of w to false
					set selected of t to true
					set index of w to 1
					activate
					return "focused " & target
				end if
			end repeat
		end repeat
	end tell
	error "no Terminal tab on " & target
end run`;

export type OpenResult = { ok: true; command: string[] } | { ok: false; error: string };

interface LiveSession {
  pid: number;
  sessionId: string;
  entrypoint?: string;
}

function isAlive(pid: number) {
  try {
    process.kill(pid, 0); // signal 0 only checks that the process exists
    return true;
  } catch {
    return false;
  }
}

/** A running Claude Code process for this session, from the CLI's internal ~/.claude/sessions/<pid>.json. */
async function findLive(id: string, dir: string): Promise<LiveSession | undefined> {
  for (const name of await readdir(dir).catch(() => [])) {
    if (!name.endsWith(".json")) continue;
    const info: LiveSession | null = await Bun.file(`${dir}/${name}`).json().catch(() => null);
    if (info?.sessionId === id && isAlive(info.pid)) return info;
  }
}

/** Controlling terminal of a process, like "ttys003" ("??" when it has none). */
async function processTty(pid: number): Promise<string | undefined> {
  try {
    const proc = Bun.spawn(["ps", "-o", "tty=", "-p", String(pid)], { stdout: "pipe", stderr: "ignore" });
    const out = await new Response(proc.stdout).text();
    return (await proc.exited) === 0 ? out.trim() : undefined;
  } catch {
    return undefined;
  }
}

/** Picks the command that would open the session, without running it. */
export async function planOpen(
  sessionId: string,
  { liveDir = LIVE_DIR, desktopDir = DESKTOP_SESSIONS_DIR, ttyOf = processTty } = {},
): Promise<OpenResult> {
  if (!isSessionId(sessionId)) return { ok: false, error: "invalid session id" };

  const desktop = await findDesktopSession(sessionId, desktopDir);
  if (desktop && LOCAL_ID.test(desktop.localId)) {
    return { ok: true, command: ["open", `claude://code/continue?session=${desktop.localId}`] };
  }
  const live = await findLive(sessionId, liveDir);
  if (live) {
    const tty = await ttyOf(live.pid);
    if (tty && TTY.test(tty)) return { ok: true, command: ["osascript", "-e", FOCUS_TERMINAL_TAB, `/dev/${tty}`] };
    return { ok: false, error: `running outside the desktop app (${live.entrypoint}, pid ${live.pid}): open it in its terminal` };
  }
  return { ok: true, command: ["claude", "--desktop", "--resume", sessionId] };
}

export async function openSession(sessionId: string): Promise<OpenResult> {
  const plan = await planOpen(sessionId);
  if (!plan.ok) return plan;

  const proc = Bun.spawn(plan.command, { stdout: "ignore", stderr: "pipe" });
  const code = await proc.exited;
  if (code !== 0) {
    const stderr = (await new Response(proc.stderr).text()).trim().slice(0, 200);
    return { ok: false, error: `${plan.command[0]} exited with ${code}${stderr ? `: ${stderr}` : ""}` };
  }
  return plan;
}
