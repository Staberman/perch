import { describe, expect, test } from "bun:test";
import { buildPanelHooks, CODEX_HOOK_URL, hasPanelHooks, HOOK_URL, mergeHooks, PID_HEADER } from "./hooks-config.ts";

const theirs = { type: "command", command: "echo mine" };

describe("mergeHooks", () => {
  test("install adds every event and keeps the user's hooks and other settings", () => {
    const merged = mergeHooks({ theme: "dark", hooks: { Stop: [{ hooks: [theirs] }] } }, { install: true });
    expect(merged.theme).toBe("dark");
    expect(merged.hooks?.Stop).toEqual([{ hooks: [theirs] }, ...buildPanelHooks().Stop!]);
    expect(Object.keys(merged.hooks!).sort()).toEqual(Object.keys(buildPanelHooks()).sort());
  });

  test("installing again changes nothing", () => {
    const once = mergeHooks({}, { install: true });
    expect(mergeHooks(once, { install: true })).toEqual(once);
  });

  test("replaces claude-panel's hooks, including the older http variant, instead of duplicating them", () => {
    const old = { hooks: { Stop: [{ hooks: [{ type: "http", url: HOOK_URL }] }], SessionStart: buildPanelHooks().SessionStart! } };
    expect(mergeHooks(old, { install: true })).toEqual(mergeHooks({}, { install: true }));
  });

  test("remove drops only ours, then empty groups, events and the hooks key", () => {
    const installed = mergeHooks({ hooks: { Stop: [{ hooks: [theirs] }] } }, { install: true });
    expect(mergeHooks(installed, { install: false })).toEqual({ hooks: { Stop: [{ hooks: [theirs] }] } });
    expect(mergeHooks(mergeHooks({ model: "opus" }, { install: true }), { install: false })).toEqual({ model: "opus" });
  });
});

test("hasPanelHooks", () => {
  expect(hasPanelHooks({})).toBe(false);
  expect(hasPanelHooks({ hooks: { Stop: [{ hooks: [theirs] }] } })).toBe(false);
  expect(hasPanelHooks(mergeHooks({}, { install: true }))).toBe(true);
});

describe("Codex hooks", () => {
  test("cover the events Codex has, post to the Codex endpoint and report the hook's parent pid", () => {
    const hooks = buildPanelHooks("codex");
    expect(Object.keys(hooks)).toContain("PermissionRequest");
    expect(Object.keys(hooks)).not.toContain("Notification");
    const command = hooks.Stop![0]!.hooks[0]!.command as string;
    expect(command).toContain(CODEX_HOOK_URL);
    expect(command).toContain(`${PID_HEADER}: $PPID`);
    expect(command.endsWith("|| true")).toBe(true);
  });

  test("merge into a hooks.json, are recognized as ours, and come out cleanly", () => {
    const merged = mergeHooks({}, { install: true, target: "codex" });
    expect(merged.hooks).toEqual(buildPanelHooks("codex"));
    expect(hasPanelHooks(merged)).toBe(true);
    expect(mergeHooks(merged, { install: true, target: "codex" })).toEqual(merged);
    expect(mergeHooks(merged, { install: false })).toEqual({});
  });
});
