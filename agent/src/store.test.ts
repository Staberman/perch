import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import type { SessionRecord } from "./state.ts";
import { Store } from "./store.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempDb() {
  const dir = mkdtempSync(`${tmpdir()}/tomari-store-`);
  dirs.push(dir);
  return `${dir}/panel.db`;
}

const ended: SessionRecord = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "pinned and closed",
  cwd: "/src",
  state: "ended",
  activity: null,
  live: false,
  pid: null,
  stateSince: 5,
  lastEventAt: 5,
};

function claudePanelDb() {
  const path = tempDb();
  const old = new Store(path);
  old.saveSession(ended);
  old.setIcon(ended.id, { character: "cat", color: "#4f7cff" });
  old.close();
  return path;
}

test("imports pins with their sessions, so pinned closed sessions still show", () => {
  const store = new Store();
  expect(store.importPinsFrom(claudePanelDb())).toBe(1);
  expect(store.loadPins().get(ended.id)).toEqual({ sessionId: ended.id, position: 0, icon: { character: "cat", color: "#4f7cff" } });
  expect(store.loadSessions()).toEqual([ended]);
});

test("imports nothing once the store has pins of its own", () => {
  const store = new Store();
  store.pin("22222222-2222-2222-2222-222222222222");
  expect(store.importPinsFrom(claudePanelDb())).toBe(0);
  expect([...store.loadPins().keys()]).toEqual(["22222222-2222-2222-2222-222222222222"]);
});

test("a missing database imports nothing", () => {
  expect(new Store().importPinsFrom(`${tempDb()}.missing`)).toBe(0);
});
