import { $ } from "bun";
import { existsSync } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { BIN_DIR, CLAUDE_PANEL_DB, CLAUDE_SETTINGS, DATA_DIR, DB_FILE, LOG_DIR, loadConfig, OVERLAY_DEFAULTS, PERCH } from "./config.ts";
import { isLoaded, LEGACY_AGENT_LABEL, PERCH_LABELS, tomariJobs, plistPath, remove, start, stop } from "./launchd.ts";
import { writeHooks } from "./settings.ts";
import { CODEX_HOME, writeCodexHooks, type CodexHooksResult } from "./codex.ts";
import { Store } from "./store.ts";

/** What a release ships next to the `tomari` binary, and setup copies into BIN_DIR. */
const SHIPPED = ["tomari", "tomari-overlay", "Tomari_TomariCore.bundle"];

export async function setup() {
  const source = dirname(process.execPath);
  const missing = SHIPPED.filter((name) => !existsSync(`${source}/${name}`));
  if (missing.length > 0) {
    throw new Error(`${missing.join(", ")} not found next to ${process.execPath}; run setup from a release build`);
  }
  const jobs = tomariJobs({ binDir: BIN_DIR, logDir: LOG_DIR });

  for (const job of jobs) await stop(job.label);
  // Its agent holds the same ports, and stopping it first leaves its database quiet for the import.
  const replacedClaudePanel = (await isLoaded(LEGACY_AGENT_LABEL)) || existsSync(plistPath(LEGACY_AGENT_LABEL));
  if (replacedClaudePanel) await remove(LEGACY_AGENT_LABEL);
  const migratedPerch = await migrateFromPerch();

  if (source !== BIN_DIR) await copyInto(source, BIN_DIR);
  const config = await loadConfig();
  const store = new Store(config.dbPath);
  const imported = store.importPinsFrom(CLAUDE_PANEL_DB);
  store.close();
  const hooksChanged = await writeHooks({ install: true });
  const codexHooks = await writeCodexHooks({ install: true });
  // A strip started by hand would hold the single-instance lock, and the LaunchAgent's copy would quit.
  await $`pkill -x tomari-overlay`.quiet().nothrow();
  for (const job of jobs) await start(job);

  console.log(`Tomari is installed and running.
  binaries : ${BIN_DIR}
  data     : ${DATA_DIR}
  logs     : ${LOG_DIR}
  hooks    : ${hooksChanged ? "added to" : "already in"} ${CLAUDE_SETTINGS}${codexSetupLine(codexHooks)}`);
  if (codexHooks === "added") {
    console.log("\nCodex runs new hooks only once you trust them: open Codex, type /hooks and trust Tomari's.");
  }
  if (migratedPerch) console.log("  moved your Perch install, with its pins, icons and token, into Tomari");
  if (replacedClaudePanel) console.log("  replaced claude-panel's agent (com.claude-panel.agent)");
  if (imported > 0) console.log(`  imported ${imported} pinned session${imported === 1 ? "" : "s"} from claude-panel`);
}

function codexSetupLine(result: CodexHooksResult): string {
  const file = `${CODEX_HOME}/hooks.json`;
  switch (result) {
    case "added":
      return `\n  codex    : hooks added to ${file}`;
    case "unchanged":
      return `\n  codex    : hooks already in ${file}`;
    case "inline":
      return `\n  codex    : skipped, ${CODEX_HOME}/config.toml declares hooks itself; see the README to add Tomari's there`;
    default:
      return ""; // no Codex: nothing to say
  }
}

/** Stops a Perch install and moves its data, logs and strip edge to Tomari's names. False when there was none. */
async function migrateFromPerch(): Promise<boolean> {
  let found = false;
  for (const label of PERCH_LABELS) {
    if ((await isLoaded(label)) || existsSync(plistPath(label))) {
      await remove(label);
      found = true;
    }
  }
  await $`pkill -x perch-overlay`.quiet().nothrow();

  if (existsSync(PERCH.dataDir) && !existsSync(DATA_DIR)) {
    await rm(`${PERCH.dataDir}/bin`, { recursive: true, force: true });
    await rename(PERCH.dataDir, DATA_DIR);
    for (const suffix of ["", "-wal", "-shm"]) {
      const from = `${DATA_DIR}/${PERCH.db}${suffix}`;
      if (existsSync(from)) await rename(from, `${DB_FILE}${suffix}`);
    }
    found = true;
  }
  await rm(PERCH.logDir, { recursive: true, force: true });

  if ((await $`defaults read ${PERCH.defaults}`.quiet().nothrow()).exitCode === 0) {
    await $`defaults export ${PERCH.defaults} - | defaults import ${OVERLAY_DEFAULTS} -`.quiet().nothrow();
    await $`defaults delete ${PERCH.defaults}`.quiet().nothrow();
  }
  return found;
}

/** Each item lands under a temporary name, then replaces the old one in a single rename. */
async function copyInto(source: string, target: string) {
  await mkdir(target, { recursive: true });
  for (const name of SHIPPED) {
    const temporary = `${target}/.${name}.new`;
    await rm(temporary, { recursive: true, force: true });
    await $`cp -Rp ${`${source}/${name}`} ${temporary}`.quiet();
    await rm(`${target}/${name}`, { recursive: true, force: true });
    await rename(temporary, `${target}/${name}`);
  }
}

export async function uninstall({ purge }: { purge: boolean }) {
  for (const job of tomariJobs({ binDir: BIN_DIR, logDir: LOG_DIR })) await remove(job.label);
  await $`pkill -f ${`${BIN_DIR}/`}`.quiet().nothrow();
  const hooksRemoved = await writeHooks({ install: false });
  const codexHooksRemoved = (await writeCodexHooks({ install: false })) === "removed";
  await rm(BIN_DIR, { recursive: true, force: true });

  const deleteData = purge || (process.stdin.isTTY && prompt(`Delete your pins and icons in ${DATA_DIR}? [y/N]`)?.trim().toLowerCase() === "y");
  if (deleteData) {
    await rm(DATA_DIR, { recursive: true, force: true });
    await rm(LOG_DIR, { recursive: true, force: true });
  }

  console.log(`Tomari is uninstalled.
  hooks : ${hooksRemoved ? "removed from" : "were not in"} ${CLAUDE_SETTINGS}${codexHooksRemoved ? `\n  codex : hooks removed from ${CODEX_HOME}/hooks.json` : ""}
  data  : ${deleteData ? "deleted" : `kept in ${DATA_DIR}`}`);
  if (existsSync(CLAUDE_PANEL_DB)) {
    console.log("\nTo bring back claude-panel's agent: in claude-panel, `bun run setup`.");
  }
}
