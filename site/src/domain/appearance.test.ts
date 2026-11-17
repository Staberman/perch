import { expect, test } from "bun:test";
import { creatureLook, statusLine, statusTone } from "./appearance.ts";
import { characters } from "./characters.ts";
import { spriteFrame, type Mood } from "./sprite.ts";
import { characterNamed } from "./characters.ts";

const critter = characterNamed("default");
const look = (state: Parameters<typeof creatureLook>[0]["state"], frame = 0) =>
  creatureLook({ character: critter, color: "#d97757", state, frame });

test("a permission request blinks its tile orange and outlines the creature", () => {
  expect(look("needsPermission", 0).tile.fill).toBe("rgba(255, 107, 26, 1)");
  expect(look("needsPermission", 2).tile.fill).toBe("rgba(255, 107, 26, 0.25)");
  expect(look("needsPermission").tile.border).toBe("rgba(255, 107, 26, 1)");
  expect(look("needsPermission").pixels.flat()).toContain("#000000");
});

test("done rings green and error rings red", () => {
  expect(look("done").tile.border).toBe("rgba(76, 217, 100, 1)");
  expect(look("error").tile.border).toBe("rgba(255, 77, 77, 1)");
});

test("focus rings the tile white unless attention outranks it", () => {
  const focused = creatureLook({ character: critter, color: "#d97757", state: "working", frame: 0, focused: true });
  expect(focused.tile.border).toBe("rgba(255, 255, 255, 0.75)");
  const urgent = creatureLook({ character: critter, color: "#d97757", state: "needsInput", frame: 0, focused: true });
  expect(urgent.tile.border).toBe("rgba(255, 107, 26, 1)");
});

test("a closed session fades to gray", () => {
  const closed = creatureLook({ character: critter, color: "#ff0000", state: "closed", frame: 0 });
  expect(closed.opacity).toBe(0.45);
  expect(closed.pixels[10]![7]).toBe("#363636");
});

test("the status line and its tone follow the overlay's hover label", () => {
  expect(statusLine({ state: "working", activity: "Bash: npm test" })).toBe("Bash: npm test");
  expect(statusLine({ state: "needsPermission", activity: "Bash: git push" })).toBe("needs permission");
  expect(statusLine({ state: "needsInput" })).toBe("waiting for you");
  expect(statusLine({ state: "done", ago: "5m" })).toBe("done · 5m");
  expect(statusTone("needsInput")).toBe("attention");
  expect(statusTone("done")).toBe("ready");
  expect(statusTone("compacting")).toBe("plain");
});

test("an outline rings the creature, marks included, for light backgrounds", () => {
  const ink = "#3b3238";
  const plain = creatureLook({ character: critter, color: "#d97757", state: "working", frame: 0 });
  const ringed = creatureLook({ character: critter, color: "#d97757", state: "working", frame: 0, outline: ink });
  expect(plain.pixels.flat()).not.toContain(ink);
  expect(ringed.pixels[4]![17]).toBe(ink);
});

test("a badge names the agent in the top-left corner and changes nothing else", () => {
  const plain = look("working");
  const codex = creatureLook({ character: critter, color: "#d97757", state: "working", frame: 0, agent: "codex" });
  const claude = creatureLook({ character: critter, color: "#d97757", state: "working", frame: 0, agent: "claude" });
  expect(codex.pixels[0]![0]).toBe("#e8e8e8");
  expect(claude.pixels[0]![2]).toBe("#d97757");
  for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) if (x >= 5 || y >= 5) expect(codex.pixels[y]![x]).toBe(plain.pixels[y]![x]!);
  const closed = creatureLook({ character: critter, color: "#d97757", state: "closed", frame: 0, agent: "claude" });
  expect(closed.pixels[0]![2]).not.toBe("#d97757"); // grayed with the rest
});

test("no character, mood or frame draws in the badge's corner", () => {
  const moods: Mood[] = ["idle", "working", "alert", "asking", "compacting", "error", "sleeping", "finished"];
  for (const character of characters)
    for (const mood of moods)
      for (let frame = 0; frame < 16; frame++) {
        const pixels = spriteFrame(character, "#d97757", mood, frame);
        for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) expect(pixels[y]![x]).toBeNull();
      }
});
