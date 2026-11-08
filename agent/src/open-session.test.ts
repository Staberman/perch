import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { planOpen, type OpenResult } from "./open-session.ts";

const ID = "0603472f-b7c5-4dae-b7a1-142468264b30";
const CLOSED = "22222222-2222-4222-8222-222222222222"; // not running
const REFUSED: OpenResult = { ok: false, error: `running outside the desktop app (cli, pid ${process.pid}): open it in its terminal` };

let root: string;
let liveDir: string;
let desktopDir: string;

beforeEach(() => {
  root = mkdtempSync(`${tmpdir()}/open-session-`);
  liveDir = `${root}/live`;
  desktopDir = `${root}/desktop`; // left missing, as on a Mac without the desktop app
  mkdirSync(liveDir);
  // process.pid makes the fake session count as running.
  writeFileSync(`${liveDir}/1.json`, JSON.stringify({ pid: process.pid, sessionId: ID, entrypoint: "cli" }));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

test("a live terminal session focuses the Terminal.app tab on its tty", async () => {
  const asked: number[] = [];
  const ttyOf = async (pid: number) => {
    asked.push(pid);
    return "ttys003";
  };
  const plan = await planOpen(ID, { liveDir, desktopDir, ttyOf });
  expect(asked).toEqual([process.pid]);
  if (!plan.ok) throw new Error(plan.error);
  const [bin, flag, script, tty] = plan.command;
  expect([bin, flag, tty]).toEqual(["osascript", "-e", "/dev/ttys003"]);
  expect(plan.command).toHaveLength(4);
  // The tty reaches the script as argv, never inside its source.
  expect(script).toContain("on run argv");
  expect(script).not.toContain("ttys003");
});

test("a live session without a valid tty is still refused", async () => {
  for (const tty of [undefined, "", "??", "console", "ttys", "ttys003\n", "ttys003; rm -rf ~", "../ttys003"]) {
    expect(await planOpen(ID, { liveDir, desktopDir, ttyOf: async () => tty })).toEqual(REFUSED);
  }
});

test("the desktop app's link still wins over the terminal tab", async () => {
  mkdirSync(`${desktopDir}/account/org`, { recursive: true });
  writeFileSync(`${desktopDir}/account/org/local_abc-123.json`, JSON.stringify({ sessionId: "local_abc-123", cliSessionId: ID }));
  expect(await planOpen(ID, { liveDir, desktopDir, ttyOf: async () => "ttys003" })).toEqual({
    ok: true,
    command: ["open", "claude://code/continue?session=local_abc-123"],
  });
});

test("without the desktop app, a closed session resumes in a new Terminal tab, in its folder", async () => {
  const plan = await planOpen(CLOSED, { liveDir, desktopDir, cwd: "/Users/dev/my project" });
  if (!plan.ok) throw new Error(plan.error);
  const [bin, flag, script, ...argv] = plan.command;
  expect([bin, flag]).toEqual(["osascript", "-e"]);
  expect(argv).toEqual(["/Users/dev/my project", CLOSED]);
  expect(script).toContain("quoted form of");
  expect(script).not.toContain(CLOSED);
});

test("without a known folder it resumes in the home folder", async () => {
  const plan = await planOpen(CLOSED, { liveDir, desktopDir });
  expect(plan.ok && plan.command.slice(3)).toEqual([homedir(), CLOSED]);
});

test("an odd folder name reaches the script only as argv", async () => {
  const cwd = `/tmp/it's "odd" $(touch pwned); rm -rf ~`;
  const plan = await planOpen(CLOSED, { liveDir, desktopDir, cwd });
  if (!plan.ok) throw new Error(plan.error);
  expect(plan.command.at(-2)).toBe(cwd);
  for (const part of ["it's", "odd", "pwned", "rm -rf"]) expect(plan.command[2]).not.toContain(part);
});

test("with the desktop app, a closed session still opens there", async () => {
  mkdirSync(desktopDir);
  expect(await planOpen(CLOSED, { liveDir, desktopDir, cwd: "/Users/dev/project" })).toEqual({
    ok: true,
    command: ["claude", "--desktop", "--resume", CLOSED],
  });
});
