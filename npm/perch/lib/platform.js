const SUPPORTED = new Set(["darwin-arm64", "darwin-x64"]);

/** The npm package holding the binaries for this OS and CPU, or null where Perch doesn't run. */
export function platformPackage(platform, arch) {
  const target = `${platform}-${arch}`;
  return SUPPORTED.has(target) ? `@elrincondeldev/perch-${target}` : null;
}
