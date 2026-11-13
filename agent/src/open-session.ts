/**
 * Opens a session in the Claude desktop app.
 * - Known to the app (running or stopped while idle): navigate with the undocumented
 *   `claude://code/continue?session=local_…`; the app restarts the session if needed.
 * - Unknown to the app and closed: `claude --desktop --resume <id>` (documented, CLI ≥ 2.1.285).
 *   Without the desktop app: `claude --resume <id>` in a new Terminal.app tab, in the session's folder.
 * - A live background session (`claude --bg`): focuses a Terminal tab already titled with its name,
 *   else `claude attach` in a new tab.
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

// Runs a command in Terminal the way NEW_TERMINAL_TAB opens a shell. `expression` is fixed source
// that builds the command from argv through `quoted form of`; the values never reach this source.
// A Terminal that isn't running opens its own window at launch: the command runs there rather
// than in a second window.
const inTerminal = (expression: string, beforeOpening = "") => `on run argv
	set command to ${expression}
	if application "Terminal" is running then
		tell application "Terminal"
${beforeOpening}			do script command
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

// Resumes a closed session, in its folder: argv is the folder, then the session id.
const RESUME_IN_TERMINAL = inTerminal(
  `"cd " & quoted form of (item 1 of argv) & " && claude --resume " & quoted form of (item 2 of argv)`,
);

// Attaches to a background session: argv is its id.
const ATTACH_IN_TERMINAL = inTerminal(`"claude attach " & quoted form of (item 1 of argv)`);

// Same, but first looks for a tab that already shows the session. Claude Code titles its tabs
// "<status glyph> <session name>", so a tab matches when its custom title is the name (item 2 of
// argv) or the name after the first two characters. A matching tab (the last one found) is brought to the front and
// nothing is opened (several usually mean duplicates of this session); none falls through to the attach. The `try` skips
// windows without tabs, which fail with -1728 when asked for them.
const FOCUS_OR_ATTACH_IN_TERMINAL = inTerminal(
  `"claude attach " & quoted form of (item 1 of argv)`,
  `			set wanted to item 2 of argv
			set matchCount to 0
			set matchWindow to missing value
			set matchTab to missing value
			repeat with w in windows
				set windowTabs to {}
				try
					set windowTabs to tabs of w
				end try
				repeat with t in windowTabs
					set tabTitle to ""
					try
						set tabTitle to custom title of t
					end try
					set isMatch to (tabTitle is wanted)
					if not isMatch and (length of tabTitle) > 2 then
						if character 2 of tabTitle is " " and (text 3 thru -1 of tabTitle) is wanted then set isMatch to true
					end if
					if isMatch then
						set matchCount to matchCount + 1
						set matchWindow to w
						set matchTab to t
					end if
				end repeat
			end repeat
			if matchCount > 0 then
				set miniaturized of matchWindow to false
				set selected of matchTab to true
				set index of matchWindow to 1
				activate
				return "focused"
			end if
`,
);

/** How `claude agents`, `claude attach` and `claude stop` name a background session: the first 8 characters of its id. */
export const backgroundId = (sessionId: string) => sessionId.slice(0, 8);

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
  {
    cwd,
    liveDir = LIVE_DIR,
    desktopDir = DESKTOP_SESSIONS_DIR,
    ttyOf = processTty,
    kind,
    name,
  }: {
    cwd?: string;
    liveDir?: string;
    desktopDir?: string;
    ttyOf?: (pid: number) => Promise<string | undefined>;
    /** What `claude agents` says the session is, if known. */
    kind?: string;
    /** The session's name, which Claude Code also uses as its Terminal tab title. */
    name?: string;
  } = {},
): Promise<OpenResult> {
  if (!isSessionId(sessionId)) return { ok: false, error: "invalid session id" };

  const desktop = await findDesktopSession(sessionId, desktopDir);
  if (desktop && LOCAL_ID.test(desktop.localId)) {
    return { ok: true, command: ["open", `claude://code/continue?session=${desktop.localId}`] };
  }
  const live = await findLive(sessionId, liveDir);
  if (live) {
    // Background sessions run in a pty the Claude daemon owns: no tty to focus. A tab may still show
    // them (a plain client), found by title; otherwise attach in a new one.
    if (kind === "background") {
      const id = backgroundId(sessionId);
      return {
        ok: true,
        command: name ? ["osascript", "-e", FOCUS_OR_ATTACH_IN_TERMINAL, id, name] : ["osascript", "-e", ATTACH_IN_TERMINAL, id],
      };
    }
    const tty = await ttyOf(live.pid);
    if (tty && TTY.test(tty)) return { ok: true, command: ["osascript", "-e", FOCUS_TERMINAL_TAB, `/dev/${tty}`] };
    return { ok: false, error: `running outside the desktop app (${live.entrypoint}, pid ${live.pid}): open it in its terminal` };
  }
  if (hasDesktopApp(desktopDir)) return { ok: true, command: ["claude", "--desktop", "--resume", sessionId] };
  const folder = cwd || (await recordedCwd(sessionId, liveDir)) || desktop?.cwd || homedir();
  return { ok: true, command: ["osascript", "-e", RESUME_IN_TERMINAL, folder, sessionId] };
}

export async function openSession(sessionId: string, cwd?: string, kind?: string, name?: string): Promise<OpenResult> {
  const plan = await planOpen(sessionId, { cwd, kind, name });
  return plan.ok ? run(plan.command) : plan;
}

/** Opens a shell, without Claude, in a new Terminal.app tab (a window unless macOS prefers tabs). */
export function openTerminalTab(): Promise<OpenResult> {
  return run(["osascript", "-e", NEW_TERMINAL_TAB]);
}

/** A hung `claude stop` or osascript (e.g. a beachballed Terminal) must not hold its caller for minutes. */
const COMMAND_TIMEOUT_MS = 15_000;

export async function run(command: string[], timeoutMs = COMMAND_TIMEOUT_MS): Promise<OpenResult> {
  const proc = Bun.spawn(command, { stdout: "ignore", stderr: "pipe" });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    proc.kill("SIGKILL");
  }, timeoutMs);
  try {
    const [code, stderr] = await Promise.all([proc.exited, new Response(proc.stderr).text()]);
    if (timedOut) return { ok: false, error: "timed out" };
    if (code !== 0) {
      const detail = stderr.trim().slice(0, 200);
      return { ok: false, error: `${command[0]} exited with ${code}${detail ? `: ${detail}` : ""}` };
    }
    return { ok: true, command };
  } finally {
    clearTimeout(timer);
  }
}
