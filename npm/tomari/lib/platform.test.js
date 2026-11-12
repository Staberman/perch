import { expect, test } from "bun:test";
import { platformPackage } from "./platform.js";

test("picks the package with the binaries for this Mac", () => {
  expect(platformPackage("darwin", "arm64")).toBe("@elrincondeldev/tomari-darwin-arm64");
  expect(platformPackage("darwin", "x64")).toBe("@elrincondeldev/tomari-darwin-x64");
});

test("anything but a Mac has none", () => {
  expect(platformPackage("linux", "x64")).toBeNull();
  expect(platformPackage("win32", "arm64")).toBeNull();
  expect(platformPackage("darwin", "ia32")).toBeNull();
});
