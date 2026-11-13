/**
 * Opens a session in the Claude desktop app.
 * - Known to the app (running or stopped while idle): navigate with the undocumented
 *   `claude://code/continue?session=local_…`; the app restarts the session if needed.
 * - Unknown to the app and closed: `claude --desktop --resume <id>` (documented, CLI ≥ 2.1.285).
 *   Without the desktop app: `claude --resume <id>` in a new Terminal.app tab, in the session's folder.
 * - Running in a terminal: brings the Terminal.app tab on its tty to the front. Without a tty it is
 *   refused, since resuming it would start a second process on the same conversation.
 */
import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { DESKTOP_SESSIONS_DIR, findDesktopSession, hasDesktopApp } from "./desktop-sessions.ts";
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

// Terminal's dictionary has no "new tab": `do script ""` opens a shell in a new window, which macOS
// files as a tab of the front window when "Prefer tabs when opening documents" is Always. A Terminal
// that isn't running opens its own window at launch, so then it is only activated.
const NEW_TERMINAL_TAB = `if application "Terminal" is running then
	tell application "Terminal"
		do script ""
		activate
	end tell
else
	tell application "Terminal" to activate
end if`;

// Resumes a closed session the way NEW_TERMINAL_TAB opens a shell. The folder and id arrive as argv
// and reach the shell through `quoted form of`, never through this source. A Terminal that isn't
// running opens its own window at launch: the command runs there rather than in a second window.
const RESUME_IN_TERMINAL = `on run argv
	set command to "cd " & quoted form of (item 1 of argv) & " && claude --resume " & quoted form of (item 2 of argv)
	if application "Terminal" is running then
		tell application "Terminal"
			do script command
			activate
		end tell
	else
		tell application "Terminal"
			activate
			repeat 50 times -- up to 5 s for the startup window
				if (count of windows) > 0 then exit repeat
				delay 0.1
			end repeat
			do script command in window 1
		end tell
	end if
end run`;

export type OpenResult = { ok: true; command: string[] } | { ok: false; error: string };

interface LiveSession {
  pid: number;
  sessionId: string;
  cwd?: string;
  entrypoint?: string;
}

export function isAlive(pid: number) {
  try {
    process.kill(pid, 0); // signal 0 only checks that the process exists
    return true;
  } catch {
    return false;
  }
}

/** Every ~/.claude/sessions/<pid>.json the CLI left behind, running or not. */
async function readSessionFiles(dir: string): Promise<LiveSession[]> {
  const infos: LiveSession[] = [];
  for (const name of await readdir(dir).catch(() => [])) {
    if (!name.endsWith(".json")) continue;
    const info: LiveSession | null = await Bun.file(`${dir}/${name}`).json().catch(() => null);
    if (info && typeof info.pid === "number" && typeof info.sessionId === "string") infos.push(info);
  }
  return infos;
}

/** Session id → pid of the CLI process, as the CLI recorded it; the process may be gone. */
export async function sessionPids(dir = LIVE_DIR): Promise<Map<string, number>> {
  const pids = new Map<string, number>();
  // A resumed session leaves its old file behind: a running pid beats a dead one.
  for (const info of await readSessionFiles(dir)) {
    const known = pids.get(info.sessionId);
    if (known === undefined || !isAlive(known)) pids.set(info.sessionId, info.pid);
  }
  return pids;
}

/** A running Claude Code process for this session, from the CLI's internal ~/.claude/sessions/<pid>.json. */
async function findLive(id: string, dir: string): Promise<LiveSession | undefined> {
  return (await readSessionFiles(dir)).find((info) => info.sessionId === id && isAlive(info.pid));
}

/** The folder the CLI recorded for a session, even after its process exited. */
async function recordedCwd(id: string, dir: string): Promise<string | undefined> {
  return (await readSessionFiles(dir)).find((info) => info.sessionId === id && info.cwd)?.cwd;
}

/** Controlling terminal of a process, like "ttys003" ("??" when it has none). */
export async function processTty(pid: number): Promise<string | undefined> {
  try {
    const proc = Bun.spawn(["ps", "-o", "tty=", "-p", String(pid)], { stdout: "pipe", stderr: "ignore" });
    const out = await new Response(proc.stdout).text();
    return (await proc.exited) === 0 ? out.trim() : undefined;
  } catch {
    return undefined;
  }
}

/** Picks the command that would open the session, without running it. `cwd` is where it last ran. */
export async function planOpen(
  sessionId: string,
  { cwd, liveDir = LIVE_DIR, desktopDir = DESKTOP_SESSIONS_DIR, ttyOf = processTty } = {},
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
  if (hasDesktopApp(desktopDir)) return { ok: true, command: ["claude", "--desktop", "--resume", sessionId] };
  const folder = cwd || (await recordedCwd(sessionId, liveDir)) || desktop?.cwd || homedir();
  return { ok: true, command: ["osascript", "-e", RESUME_IN_TERMINAL, folder, sessionId] };
}

export async function openSession(sessionId: string, cwd?: string): Promise<OpenResult> {
  const plan = await planOpen(sessionId, { cwd });
  return plan.ok ? run(plan.command) : plan;
}

/** Opens a shell, without Claude, in a new Terminal.app tab (a window unless macOS prefers tabs). */
export function openTerminalTab(): Promise<OpenResult> {
  return run(["osascript", "-e", NEW_TERMINAL_TAB]);
}

async function run(command: string[]): Promise<OpenResult> {
  const proc = Bun.spawn(command, { stdout: "ignore", stderr: "pipe" });
  const code = await proc.exited;
  if (code !== 0) {
    const stderr = (await new Response(proc.stderr).text()).trim().slice(0, 200);
    return { ok: false, error: `${command[0]} exited with ${code}${stderr ? `: ${stderr}` : ""}` };
  }
  return { ok: true, command };
}
