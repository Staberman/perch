/**
 * Sessions known to the Claude desktop app, from its metadata files (undocumented):
 * ~/Library/Application Support/Claude/claude-code-sessions/<account>/<org>/local_<id>.json.
 * They outlive the CLI process, which the app stops when a session sits idle.
 */
import { homedir } from "node:os";
import { isSessionId } from "./protocol-guard.ts";

export const DESKTOP_SESSIONS_DIR = `${homedir()}/Library/Application Support/Claude/claude-code-sessions`;

export interface DesktopSession {
  /** The app's id, used in claude:// links. */
  localId: string;
  /** The CLI session id that hooks and `claude agents` report. */
  sessionId: string;
  title: string | null;
  cwd: string;
  lastActivityAt: number;
  archived: boolean;
}

/** Every desktop session, most recently active first. */
export async function listDesktopSessions(dir = DESKTOP_SESSIONS_DIR): Promise<DesktopSession[]> {
  const sessions: DesktopSession[] = [];
  for await (const path of new Bun.Glob("*/*/local_*.json").scan({ cwd: dir, absolute: true })) {
    const session = parse(await Bun.file(path).json().catch(() => null));
    if (session) sessions.push(session);
  }
  return sessions.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
}

export async function findDesktopSession(sessionId: string, dir = DESKTOP_SESSIONS_DIR): Promise<DesktopSession | undefined> {
  return (await listDesktopSessions(dir)).find((s) => s.sessionId === sessionId);
}

/** CLI session id of a desktop `local_…` session. */
export async function cliSessionIdFor(localId: string, dir = DESKTOP_SESSIONS_DIR): Promise<string | null> {
  for await (const path of new Bun.Glob(`*/*/${localId}.json`).scan({ cwd: dir, absolute: true })) {
    const session = parse(await Bun.file(path).json().catch(() => null));
    if (session) return session.sessionId;
  }
  return null;
}

function parse(meta: Record<string, unknown> | null): DesktopSession | null {
  if (!meta || typeof meta.sessionId !== "string" || !meta.sessionId.startsWith("local_")) return null;
  if (!isSessionId(meta.cliSessionId)) return null;
  return {
    localId: meta.sessionId,
    sessionId: meta.cliSessionId,
    title: typeof meta.title === "string" ? meta.title : null,
    cwd: typeof meta.cwd === "string" ? meta.cwd : "",
    lastActivityAt: typeof meta.lastActivityAt === "number" ? meta.lastActivityAt : 0,
    archived: meta.isArchived === true,
  };
}
