import { expect, test } from "bun:test";
import { formatStars } from "./github.ts";

test("shows small counts whole and large ones in thousands", () => {
  expect(formatStars(0)).toBe("0");
  expect(formatStars(17)).toBe("17");
  expect(formatStars(999)).toBe("999");
  expect(formatStars(1000)).toBe("1k");
  expect(formatStars(1249)).toBe("1.2k");
  expect(formatStars(9960)).toBe("10k");
  expect(formatStars(12_400)).toBe("12k");
});
