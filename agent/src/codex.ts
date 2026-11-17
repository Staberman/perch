/**
 * What Tomari reads from and writes to OpenAI's Codex, which reports to the agent through hooks like Claude Code.
 * - `$CODEX_HOME/hooks.json` (default ~/.codex): the hooks, the same shape as Claude Code's `hooks` block.
 *   Codex runs a new or changed hook only once the user trusts it with `/hooks`; Tomari never marks it trusted.
 * - `$CODEX_HOME/session_index.jsonl`: one `{id, thread_name}` line per titled thread, the last line winning.
 * - The rollout `$CODEX_HOME/sessions/YYYY/MM/DD/rollout-<time>-<id>.jsonl`: its first line names the
 *   originator, which tells a thread of the Codex app from one of the CLI.
 * - `$CODEX_HOME/state_<n>.sqlite`, read only: the `threads` table the Codex app lists its threads from, so the +
 *   can offer them running or not. `external_agent_session_imports.json` names the threads Codex imported from
 *   Claude Code, which the + already lists as Claude's.
 */
import { Database } from "bun:sqlite";
import { readdirSync } from "node:fs";
import { copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, resolve, sep } from "node:path";
import { CODEX_EVENTS, hasPanelHooks, mergeHooks, type Settings } from "./hooks-config.ts";
import { isSessionId } from "./protocol-guard.ts";
import type { HookEvent } from "./state.ts";

export const CODEX_HOME = process.env.CODEX_HOME || join(homedir(), ".codex");

const paths = (home: string) => ({
  hooks: join(home, "hooks.json"),
  config: join(home, "config.toml"),
  index: join(home, "session_index.jsonl"),
  sessions: join(home, "sessions"),
});

/** Codex is installed when its home exists: the CLI and the app both create it. */
export function hasCodex(home = CODEX_HOME) {
  return existsSync(home);
}

/**
 * True when config.toml declares hooks inline (`[[hooks.Stop]]`, `[hooks.PreToolUse]`, …): Codex warns when one
 * layer declares hooks in both files, so then hooks.json is left alone. `[hooks.state…]`, where Codex keeps
 * which hooks are trusted, is not a declaration.
 */
export function declaresInlineHooks(configToml: string) {
  const events = CODEX_EVENTS.join("|");
  return new RegExp(`^\\s*\\[\\[?\\s*hooks\\s*\\.\\s*"?(${events})"?\\s*[\\].]`, "m").test(configToml);
}

export type CodexHooksResult = "added" | "unchanged" | "removed" | "absent" | "no-codex" | "inline";

/** Adds or removes Tomari's hooks in Codex's hooks.json, backing the file up first. */
export async function writeCodexHooks({ install }: { install: boolean }, home = CODEX_HOME): Promise<CodexHooksResult> {
  if (!hasCodex(home)) return "no-codex";
  const file = paths(home);
  if (install) {
    const config = Bun.file(file.config);
    if ((await config.exists()) && declaresInlineHooks(await config.text())) return "inline";
  }
  const exists = await Bun.file(file.hooks).exists();
  const before: Settings = exists ? await Bun.file(file.hooks).json() : {};
  const after = mergeHooks(before, { install, target: "codex" });
  if (JSON.stringify(after) === JSON.stringify(before)) return install ? "unchanged" : "absent";
  if (exists) await copyFile(file.hooks, `${file.hooks}.bak-tomari-${Date.now()}`);
  await Bun.write(file.hooks, JSON.stringify(after, null, 2) + "\n");
  return install ? "added" : "removed";
}

export async function codexHooksInstalled(home = CODEX_HOME): Promise<boolean> {
  const file = Bun.file(paths(home).hooks);
  return (await file.exists()) && hasPanelHooks(await file.json().catch(() => ({})));
}

const INDEX_TAIL_BYTES = 512 * 1024;

/** Thread titles by session id, from the end of session_index.jsonl; empty when it can't be read. Never throws. */
export async function codexThreadNames(home = CODEX_HOME): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  try {
    const file = Bun.file(paths(home).index);
    if (!(await file.exists())) return names;
    const tail = await file.slice(Math.max(0, file.size - INDEX_TAIL_BYTES)).text();
    for (const line of tail.split("\n")) {
      let entry: { id?: unknown; thread_name?: unknown };
      try {
        entry = JSON.parse(line);
      } catch {
        continue; // also the first line, which the tail may have cut
      }
      const name = typeof entry.thread_name === "string" ? entry.thread_name.replace(/\s+/g, " ").trim() : "";
      if (isSessionId(entry.id) && name) names.set(entry.id, name);
    }
  } catch {
    // fail soft: sessions keep their folder name
  }
  return names;
}

/** The rollout of a session: the hook's `transcript_path` when it lies inside `$CODEX_HOME/sessions`, else a search. */
export async function codexRollout(sessionId: string, transcriptPath?: string, home = CODEX_HOME): Promise<string | null> {
  if (!isSessionId(sessionId)) return null;
  const root = paths(home).sessions;
  if (transcriptPath && isAbsolute(transcriptPath)) {
    const path = resolve(transcriptPath);
    if (path.startsWith(resolve(root) + sep) && path.endsWith(".jsonl") && (await Bun.file(path).exists())) return path;
  }
  if (!existsSync(root)) return null;
  for await (const found of new Bun.Glob(`*/*/*/rollout-*-${sessionId}.jsonl`).scan({ cwd: root, onlyFiles: true })) {
    return join(root, found);
  }
  return null;
}

/** Whether the Codex app started the thread, from its rollout's session_meta; false when unknown. Never throws. */
export async function startedInCodexApp(sessionId: string, transcriptPath?: string, home = CODEX_HOME): Promise<boolean> {
  try {
    const rollout = await codexRollout(sessionId, transcriptPath, home);
    if (!rollout) return false;
    const head = await Bun.file(rollout).slice(0, 64 * 1024).text();
    const meta = JSON.parse(head.split("\n")[0] ?? "");
    const originator = String(meta?.payload?.originator ?? "");
    return /desktop/i.test(originator);
  } catch {
    return false;
  }
}

/**
 * Decides which Codex sessions Tomari tracks. The Codex app runs hooks for sessions nobody sees: the empty thread
 * it opens ahead of "New thread" (only SessionStart, then SessionEnd) and the short ephemeral session that writes
 * a thread's title (no rollout at all). A session counts once it does something besides starting or ending and
 * has a rollout; until then each event checks again, so a real session shows up at most one event late.
 */
export function codexAdmission(hasRollout: (sessionId: string, transcriptPath?: string) => Promise<boolean> = async (id, path) => (await codexRollout(id, path)) !== null) {
  const admitted = new Set<string>();
  return async (event: HookEvent, known: boolean): Promise<boolean> => {
    if (known || admitted.has(event.session_id)) return true;
    if (event.hook_event_name === "SessionStart" || event.hook_event_name === "SessionEnd") return false;
    const transcriptPath = typeof event.transcript_path === "string" ? event.transcript_path : undefined;
    if (!(await hasRollout(event.session_id, transcriptPath))) return false;
    admitted.add(event.session_id);
    return true;
  };
}

export interface CodexThread {
  id: string;
  name: string;
  cwd: string;
  /** Epoch ms. */
  lastActivityAt: number;
}

/** The newest `state_<n>.sqlite` in the Codex home, or null. */
function stateDatabase(home: string): string | null {
  let best: { n: number; name: string } | null = null;
  for (const name of readdirSync(home)) {
    const n = /^state_(\d+)\.sqlite$/.exec(name)?.[1];
    if (n && (!best || Number(n) > best.n)) best = { n: Number(n), name };
  }
  return best ? join(home, best.name) : null;
}

/**
 * Opens Codex's database read only. A WAL database opens that way only while its `-shm` file exists, that is
 * while Codex has it open; once Codex quits cleanly it removes `-wal` and `-shm`, and every row is in the main
 * file, which then reads as immutable, creating nothing next to it.
 */
export function openCodexDatabase(path: string): Database {
  const immutable = () => new Database(`file:${encodeURI(path).replace(/\?/g, "%3F").replace(/#/g, "%23")}?immutable=1`, { readonly: true });
  if (!existsSync(`${path}-wal`)) return immutable();
  try {
    return new Database(path, { readonly: true });
  } catch {
    return immutable(); // a -wal without its -shm: the main file is still a consistent, if slightly older, view
  }
}

/** Ids of the threads Codex imported from another agent (Claude Code); empty when unknown. */
async function importedThreadIds(home: string): Promise<Set<string>> {
  try {
    const data = await Bun.file(join(home, "external_agent_session_imports.json")).json();
    const records: unknown[] = Array.isArray(data?.records) ? data.records : [];
    return new Set(records.map((r) => (r as { imported_thread_id?: unknown })?.imported_thread_id).filter(isSessionId));
  } catch {
    return new Set();
  }
}

/**
 * The threads a person started in Codex, most recent first: not archived, with a title, and none of a subagent's,
 * a guardian review's, or one imported from Claude Code. Empty when Codex's database can't be read. Never throws.
 */
export async function codexThreads(home = CODEX_HOME, limit = 100): Promise<CodexThread[]> {
  try {
    if (!hasCodex(home)) return [];
    const path = stateDatabase(home);
    if (!path) return [];
    const imported = await importedThreadIds(home);
    const db = openCodexDatabase(path);
    try {
      const rows = db
        .query<{ id: string; name: string; cwd: string; at: number }, [number]>(
          `SELECT id, COALESCE(NULLIF(TRIM(name), ''), title) AS name, cwd,
                  MAX(COALESCE(recency_at_ms, 0), COALESCE(updated_at_ms, updated_at * 1000)) AS at
           FROM threads
           WHERE archived = 0 AND TRIM(title) != '' AND source NOT LIKE '{%'
             AND (thread_source IS NULL OR thread_source = 'user')
           ORDER BY at DESC LIMIT ?`,
        )
        .all(limit + imported.size);
      return rows
        .filter((row) => isSessionId(row.id) && !imported.has(row.id))
        .slice(0, limit)
        .map((row) => ({ id: row.id, name: row.name.replace(/\s+/g, " ").trim(), cwd: row.cwd, lastActivityAt: row.at }));
    } finally {
      db.close();
    }
  } catch {
    return [];
  }
}

export interface ProcessInfo {
  ppid: number;
  command: string;
}

/** Parent pid and executable name of a process, or null when it is gone. */
export async function processInfo(pid: number): Promise<ProcessInfo | null> {
  try {
    const proc = Bun.spawn(["ps", "-o", "ppid=,comm=", "-p", String(pid)], { stdout: "pipe", stderr: "ignore" });
    const out = (await new Response(proc.stdout).text()).trim();
    if ((await proc.exited) !== 0 || !out) return null;
    const match = /^(\d+)\s+(.+)$/.exec(out);
    return match ? { ppid: Number(match[1]), command: match[2]! } : null;
  } catch {
    return null;
  }
}

const MAX_HOPS = 4;

/**
 * The Codex process behind a hook, from the pid the hook reported (its shell's parent). Walks up a few
 * parents in case Codex runs hooks through a wrapper, and gives null rather than a pid that would die
 * with the hook. Results are cached by reported pid.
 */
export function codexPidResolver(info: (pid: number) => Promise<ProcessInfo | null> = processInfo) {
  const cache = new Map<number, number | null>();
  return async (reported: number): Promise<number | null> => {
    if (cache.has(reported)) return cache.get(reported)!;
    let pid = reported;
    let found: number | null = null;
    for (let hop = 0; hop < MAX_HOPS && pid > 1; hop++) {
      const process = await info(pid);
      if (!process) break;
      if (/(^|\/)codex[^/]*$/i.test(process.command)) {
        found = pid;
        break;
      }
      pid = process.ppid;
    }
    if (cache.size > 500) cache.clear();
    cache.set(reported, found);
    return found;
  };
}
