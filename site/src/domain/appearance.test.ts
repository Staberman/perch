import { expect, test } from "bun:test";
import { creatureLook, statusLine, statusTone } from "./appearance.ts";
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
