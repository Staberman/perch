import { describe, expect, test } from "bun:test";
import { buildPanelHooks, hasPanelHooks, HOOK_URL, mergeHooks } from "./hooks-config.ts";

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
