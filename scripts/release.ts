/**
 * Builds the npm packages into dist/npm: @elrincondeldev/perch, the launcher, and one package of
 * binaries per macOS architecture, which setup copies into place.
 *
 *   bun scripts/release.ts [--version 1.2.3] [--arch arm64|x64]...
 */
import { $ } from "bun";
import { cp, mkdir, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { parseArgs } from "node:util";

const ROOT = dirname(import.meta.dir);
const DIST = `${ROOT}/dist/npm`;
const SCOPE = "@elrincondeldev";
const ARCHS = { arm64: { swift: "arm64", label: "Apple Silicon" }, x64: { swift: "x86_64", label: "Intel" } } as const;
type Arch = keyof typeof ARCHS;

const { values } = parseArgs({ options: { version: { type: "string" }, arch: { type: "string", multiple: true } } });
const version = values.version ?? "0.0.0-dev";
const archs = (values.arch ?? Object.keys(ARCHS)) as Arch[];
for (const arch of archs) if (!(arch in ARCHS)) throw new Error(`unknown arch: ${arch}`);

const launcher = await Bun.file(`${ROOT}/npm/perch/package.json`).json();
const common = { version, license: launcher.license, homepage: launcher.homepage, repository: launcher.repository };

await rm(DIST, { recursive: true, force: true });

for (const arch of archs) {
  const name = `perch-darwin-${arch}`;
  const bin = `${DIST}/${name}/bin`;
  await mkdir(bin, { recursive: true });

  await $`bun build ${`${ROOT}/agent/src/perch.ts`} --compile --minify --target=${`bun-darwin-${arch}`} --define ${`PERCH_VERSION=${JSON.stringify(version)}`} --outfile ${`${bin}/perch`}`;

  const swiftArch = ARCHS[arch].swift;
  await $`swift build -c release --arch ${swiftArch} --product perch-overlay`.cwd(ROOT);
  const swiftBin = (await $`swift build -c release --arch ${swiftArch} --show-bin-path`.cwd(ROOT).text()).trim();
  await cp(`${swiftBin}/perch-overlay`, `${bin}/perch-overlay`);
  await cp(`${swiftBin}/Perch_PerchCore.bundle`, `${bin}/Perch_PerchCore.bundle`, { recursive: true });

  // Ad-hoc signatures: enough for binaries that npm and Homebrew deliver without quarantine.
  await $`codesign --force --sign - ${`${bin}/perch`} ${`${bin}/perch-overlay`}`;

  await Bun.write(
    `${DIST}/${name}/package.json`,
    JSON.stringify(
      { name: `${SCOPE}/${name}`, ...common, description: `${ARCHS[arch].label} binaries for ${SCOPE}/perch`, os: ["darwin"], cpu: [arch], files: ["bin"] },
      null,
      2,
    ) + "\n",
  );
  await cp(`${ROOT}/LICENSE`, `${DIST}/${name}/LICENSE`);
}

const main = `${DIST}/perch`;
await mkdir(`${main}/lib`, { recursive: true });
await cp(`${ROOT}/npm/perch/bin`, `${main}/bin`, { recursive: true });
await cp(`${ROOT}/npm/perch/lib/platform.js`, `${main}/lib/platform.js`);
await cp(`${ROOT}/LICENSE`, `${main}/LICENSE`);
// npmjs.com can't resolve the README's relative image path.
const readme = await Bun.file(`${ROOT}/README.md`).text();
await Bun.write(`${main}/README.md`, readme.replaceAll('src="images/', 'src="https://raw.githubusercontent.com/elrincondeldev/perch/main/images/'));
const optionalDependencies = Object.fromEntries(Object.keys(ARCHS).map((arch) => [`${SCOPE}/perch-darwin-${arch}`, version]));
await Bun.write(`${main}/package.json`, JSON.stringify({ ...launcher, version, optionalDependencies }, null, 2) + "\n");

console.log(`Built ${version} for ${archs.join(", ")} in ${DIST}`);
