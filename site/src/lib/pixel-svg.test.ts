import { expect, test } from "bun:test";
import { pixelRects } from "./pixel-svg.ts";

test("merges each horizontal run of one color into a single rect", () => {
  const a = "#111111";
  const b = "#222222";
  expect(pixelRects([[a, a, null, b], [null, null, null, null]])).toBe(
    `<rect x="0" y="0" width="2" height="1" fill="${a}"/><rect x="3" y="0" width="1" height="1" fill="${b}"/>`,
  );
});
