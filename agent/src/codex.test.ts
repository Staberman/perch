import { afterEach, beforeEach, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  codexAdmission,
  codexHooksInstalled,
  codexPidResolver,
  codexRollout,
  codexThreadNames,
  codexThreads,
  declaresInlineHooks,
  startedInCodexApp,
  writeCodexHooks,
  type ProcessInfo,
} from "./codex.ts";
import { buildPanelHooks, CODEX_HOOK_URL } from "./hooks-config.ts";

const ID = "01a19325-4897-7c80-a727-4efd4c245bf1";
const OTHER = "01a1abd9-75ff-7563-89b5-bd11066f050b";

let home: string;
beforeEach(() => {
  home = mkdtempSync(`${tmpdir()}/codex-home-`);
});
afterEach(() => rmSync(home, { recursive: true, force: true }));

const hooksFile = () => `${home}/hooks.json`;
const readHooks = () => JSON.parse(readFileSync(hooksFile(), "utf8"));

test("hooks: nothing is written without a Codex home", async () => {
  rmSync(home, { recursive: true });
  expect(await writeCodexHooks({ install: true }, home)).toBe("no-codex");
  expect(existsSync(home)).toBe(false);
});

test("hooks: setup adds Codex's set, keeps the user's own, backs the file up, and removes only ours", async () => {
  const mine = { type: "command", command: "echo mine" };
  writeFileSync(hooksFile(), JSON.stringify({ hooks: { Stop: [{ hooks: [mine] }] } }));

  expect(await writeCodexHooks({ install: true }, home)).toBe("added");
  const installed = readHooks();
  expect(installed.hooks.Stop).toEqual([{ hooks: [mine] }, ...buildPanelHooks("codex").Stop!]);
  expect(installed.hooks.PermissionRequest[0].hooks[0].command).toContain(CODEX_HOOK_URL);
  expect(readdirSync(home).some((name) => name.startsWith("hooks.json.bak-tomari-"))).toBe(true);
  expect(await codexHooksInstalled(home)).toBe(true);

  expect(await writeCodexHooks({ install: true }, home)).toBe("unchanged");
  expect(await writeCodexHooks({ install: false }, home)).toBe("removed");
  expect(readHooks()).toEqual({ hooks: { Stop: [{ hooks: [mine] }] } });
  expect(await codexHooksInstalled(home)).toBe(false);
  expect(await writeCodexHooks({ install: false }, home)).toBe("absent");
});

test("hooks: a home without hooks.json gets one", async () => {
  expect(await writeCodexHooks({ install: true }, home)).toBe("added");
  expect(Object.keys(readHooks().hooks).sort()).toEqual(Object.keys(buildPanelHooks("codex")).sort());
});

test("hooks: hooks declared inline in config.toml leave hooks.json alone", async () => {
  writeFileSync(`${home}/config.toml`, 'model = "o3"\n\n[[hooks.Stop]]\n[[hooks.Stop.hooks]]\ntype = "command"\ncommand = "say done"\n');
  expect(await writeCodexHooks({ install: true }, home)).toBe("inline");
  expect(existsSync(hooksFile())).toBe(false);
});

test("declaresInlineHooks: event tables count, the trust records Codex keeps there do not", () => {
  expect(declaresInlineHooks("[[hooks.PreToolUse]]\nmatcher = \"^Bash$\"")).toBe(true);
  expect(declaresInlineHooks("[hooks.Stop]\n")).toBe(true);
  expect(declaresInlineHooks('  [[ hooks."SessionStart".hooks ]]')).toBe(true);
  expect(declaresInlineHooks('[hooks.state."user:Stop:0"]\ntrusted_hash = "abc"')).toBe(false);
  expect(declaresInlineHooks('[features]\nhooks = true\n[mcp_servers.hooks]\n')).toBe(false);
});

test("thread names: the last title per id wins, and bad lines are skipped", async () => {
  writeFileSync(
    `${home}/session_index.jsonl`,
    [
      JSON.stringify({ id: ID, thread_name: "first title", updated_at: "x" }),
      "not json",
      JSON.stringify({ id: OTHER, thread_name: "  Guardian\n review " }),
      JSON.stringify({ id: "not-a-uuid", thread_name: "ignored" }),
      JSON.stringify({ id: ID, thread_name: "renamed" }),
      JSON.stringify({ id: OTHER, thread_name: "" }),
      "",
    ].join("\n"),
  );
  expect(await codexThreadNames(home)).toEqual(new Map([[ID, "renamed"], [OTHER, "Guardian review"]]));
});

test("thread names: no index, no names", async () => {
  expect((await codexThreadNames(home)).size).toBe(0);
});

function writeRollout(id: string, originator: string) {
  const dir = `${home}/sessions/2026/10/31`;
  mkdirSync(dir, { recursive: true });
  const path = `${dir}/rollout-2026-10-31T19-07-36-${id}.jsonl`;
  writeFileSync(path, `${JSON.stringify({ type: "session_meta", payload: { id, originator } })}\n{"type":"event"}\n`);
  return path;
}

test("rollouts are found by id, and only an app thread opens in the app", async () => {
  const app = writeRollout(ID, "Codex Desktop");
  writeRollout(OTHER, "codex_cli_rs");
  expect(await codexRollout(ID, undefined, home)).toBe(app);
  expect(await startedInCodexApp(ID, undefined, home)).toBe(true);
  expect(await startedInCodexApp(OTHER, undefined, home)).toBe(false);
  expect(await startedInCodexApp("33333333-3333-4333-8333-333333333333", undefined, home)).toBe(false);
});

test("rollouts: a transcript path outside the sessions folder is not read", async () => {
  const outside = `${home}/elsewhere-${ID}.jsonl`;
  writeFileSync(outside, `${JSON.stringify({ payload: { originator: "Codex Desktop" } })}\n`);
  expect(await codexRollout(ID, outside, home)).toBe(null);
  expect(await startedInCodexApp(ID, outside, home)).toBe(false);
  expect(await codexRollout("../../etc/passwd", undefined, home)).toBe(null);
});

test("pid: the hook's shell parent is used when it is Codex, else a Codex ancestor, else nothing", async () => {
  const table: Record<number, ProcessInfo> = {
    100: { ppid: 1, command: "/usr/local/lib/node_modules/@openai/codex/vendor/bin/codex" },
    200: { ppid: 100, command: "/bin/zsh" },
    300: { ppid: 1, command: "/bin/bash" },
  };
  const asked: number[] = [];
  const resolve = codexPidResolver(async (pid) => {
    asked.push(pid);
    return table[pid] ?? null;
  });
  expect(await resolve(100)).toBe(100);
  expect(await resolve(200)).toBe(100);
  expect(await resolve(300)).toBe(null);
  expect(await resolve(999)).toBe(null);
  const before = asked.length;
  expect(await resolve(200)).toBe(100); // cached
  expect(asked.length).toBe(before);
});

test("admission: only sessions that do something and have a rollout are tracked", async () => {
  const withRollout = new Set([ID]);
  const checked: string[] = [];
  const admit = codexAdmission(async (id) => {
    checked.push(id);
    return withRollout.has(id);
  });
  const event = (session_id: string, hook_event_name: string) => ({ session_id, hook_event_name, cwd: "/tmp" });

  // The thread the app opens ahead of time: it only starts and ends.
  expect(await admit(event(OTHER, "SessionStart"), false)).toBe(false);
  expect(await admit(event(OTHER, "SessionEnd"), false)).toBe(false);
  // The ephemeral title writer: it works, but never has a rollout.
  expect(await admit(event(OTHER, "UserPromptSubmit"), false)).toBe(false);
  expect(await admit(event(OTHER, "Stop"), false)).toBe(false);
  // A real thread: its first prompt lets it in, and later events, SessionEnd included, need no check.
  expect(await admit(event(ID, "SessionStart"), false)).toBe(false);
  expect(await admit(event(ID, "UserPromptSubmit"), false)).toBe(true);
  const before = checked.length;
  expect(await admit(event(ID, "SessionEnd"), false)).toBe(true);
  expect(checked.length).toBe(before);
  // A session the hub already tracks, e.g. from before a restart, needs no check either.
  expect(await admit(event(OTHER, "Stop"), true)).toBe(true);
});

test("admission: a rollout written after the first prompt lets the session in at its next event", async () => {
  let written = false;
  const admit = codexAdmission(async () => written);
  expect(await admit({ session_id: ID, hook_event_name: "UserPromptSubmit", cwd: "/tmp" }, false)).toBe(false);
  written = true;
  expect(await admit({ session_id: ID, hook_event_name: "PreToolUse", cwd: "/tmp" }, false)).toBe(true);
});

test("threads: those a person started, newest first, without archived, empty, internal or imported ones", async () => {
  const { Database } = await import("bun:sqlite");
  const db = new Database(`${home}/state_5.sqlite`, { create: true });
  db.exec(`CREATE TABLE threads (id TEXT PRIMARY KEY, title TEXT NOT NULL, name TEXT, cwd TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL, thread_source TEXT, updated_at INTEGER NOT NULL, updated_at_ms INTEGER, recency_at_ms INTEGER NOT NULL DEFAULT 0)`);
  const add = db.query("INSERT INTO threads VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const id = (n: number) => `01a1eb1b-0000-7000-8000-${String(n).padStart(12, "0")}`;
  add.run(id(1), "Esto es un test", "Identificar un test", "/w/shy-planner", 0, "vscode", "user", 1, 1000, 1000);
  add.run(id(2), "Old one", null, "/w/old", 0, "vscode", null, 1, 500, 0);
  add.run(id(3), "", null, "/w/empty", 0, "vscode", "user", 1, 3000, 3000); // opened ahead of "New thread"
  add.run(id(4), "Archived", null, "/w/a", 1, "vscode", "user", 1, 4000, 4000);
  add.run(id(5), "Review", null, "/w/r", 0, '{"subagent":{"other":"guardian"}}', "guardian_review", 1, 5000, 5000);
  add.run(id(6), "Spawned", null, "/w/s", 0, '{"subagent":{"thread_spawn":{}}}', "subagent", 1, 6000, 6000);
  add.run(id(7), "From Claude", null, "/w/c", 0, "vscode", null, 1, 7000, 7000);
  add.run(id(8), "CLI", null, "/w/cli", 0, "exec", "user", 1, 800, 2000); // recency wins over updated_at
  db.close();
  writeFileSync(`${home}/external_agent_session_imports.json`, JSON.stringify({ records: [{ imported_thread_id: id(7) }] }));
  writeFileSync(`${home}/state_4.sqlite`, "an older database, never read");

  expect(await codexThreads(home)).toEqual([
    { id: id(8), name: "CLI", cwd: "/w/cli", lastActivityAt: 2000 },
    { id: id(1), name: "Identificar un test", cwd: "/w/shy-planner", lastActivityAt: 1000 },
    { id: id(2), name: "Old one", cwd: "/w/old", lastActivityAt: 500 },
  ]);
  expect((await codexThreads(home, 1)).map((t) => t.id)).toEqual([id(8)]);
});

test("threads: no database, or one Codex changed beyond recognition, lists nothing", async () => {
  expect(await codexThreads(home)).toEqual([]);
  writeFileSync(`${home}/state_9.sqlite`, "not sqlite");
  expect(await codexThreads(home)).toEqual([]);
});

test("threads: Codex's WAL database reads after Codex quit and took its -wal and -shm with it", async () => {
  const { Database } = await import("bun:sqlite");
  const path = `${home}/state_5.sqlite`;
  const db = new Database(path, { create: true });
  db.exec("PRAGMA journal_mode = WAL");
  db.exec(`CREATE TABLE threads (id TEXT PRIMARY KEY, title TEXT NOT NULL, name TEXT, cwd TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL, thread_source TEXT, updated_at INTEGER NOT NULL, updated_at_ms INTEGER, recency_at_ms INTEGER NOT NULL DEFAULT 0)`);
  db.query("INSERT INTO threads VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(ID, "Kept", null, "/w/k", 0, "vscode", "user", 1, 1000, 1000);
  // What Codex quitting cleanly leaves: everything checkpointed into the main file, no -wal and no -shm.
  db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  db.close();
  rmSync(`${path}-wal`, { force: true });
  rmSync(`${path}-shm`, { force: true });
  expect((await codexThreads(home)).map((t) => t.name)).toEqual(["Kept"]);
  expect(readdirSync(home).sort()).toEqual(["state_5.sqlite"]); // and the read left nothing behind

  // While Codex has it open, with rows still in the WAL, a normal read only open sees them too.
  const open = new Database(path);
  open.exec("PRAGMA wal_autocheckpoint = 0");
  open.query("INSERT INTO threads VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(OTHER, "In the WAL", null, "/w/w", 0, "vscode", "user", 1, 2000, 2000);
  expect((await codexThreads(home)).map((t) => t.name)).toEqual(["In the WAL", "Kept"]);
  open.close();
});
