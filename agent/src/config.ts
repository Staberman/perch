/**
 * Where Perch lives on disk. The data dir holds config.json with the pairing token (created on
 * first run, mode 600), perch.db the SQLite store, and bin/ the binaries the LaunchAgents run.
 * The overlay reads the token from here too (Sources/PerchCore/AgentConfig.swift).
 */
import { $ } from "bun";
import { randomBytes } from "node:crypto";
import { chmod, mkdir } from "node:fs/promises";
import { homedir, networkInterfaces } from "node:os";
import { PANEL_PORT } from "../../shared/protocol.ts";

export const HOOK_PORT = 7777;

const HOME = homedir();
export const DATA_DIR = `${HOME}/Library/Application Support/perch`;
export const BIN_DIR = `${DATA_DIR}/bin`;
export const LOG_DIR = `${HOME}/Library/Logs/perch`;
export const CLAUDE_SETTINGS = `${HOME}/.claude/settings.json`;
/** The agent Perch replaces: setup imports its pins and reuses its pairing token, so a paired Pi keeps working. */
const CLAUDE_PANEL_DIR = `${HOME}/Library/Application Support/claude-panel`;
export const CLAUDE_PANEL_DB = `${CLAUDE_PANEL_DIR}/panel.db`;
export const CLAUDE_PANEL_CONFIG = `${CLAUDE_PANEL_DIR}/config.json`;
export const CONFIG_FILE = `${DATA_DIR}/config.json`;

/**
 * WebSocket URLs other devices on the LAN can use to reach this Mac: its IPv4 addresses
 * (Wi-Fi/Ethernet first), then its Bonjour name. IPs come first because some routers drop
 * mDNS between WiFi clients; the name still works if the Mac's IP changes later.
 */
export async function panelUrls(): Promise<string[]> {
  const ips = Object.entries(networkInterfaces())
    .sort(([a], [b]) => Number(b.startsWith("en")) - Number(a.startsWith("en")))
    .flatMap(([, addresses]) => addresses ?? [])
    .filter((a) => a.family === "IPv4" && !a.internal)
    .map((a) => a.address);
  const host = (await $`scutil --get LocalHostName`.quiet().nothrow().text()).trim();
  return [...ips, ...(host ? [`${host}.local`] : [])].map((address) => `ws://${address}:${PANEL_PORT}/ws`);
}

export interface Config {
  dataDir: string;
  dbPath: string;
  token: string;
}

export async function loadConfig(): Promise<Config> {
  const dataDir = DATA_DIR;
  await mkdir(dataDir, { recursive: true });

  const path = CONFIG_FILE;
  const file = Bun.file(path);
  const saved: { token?: string } = (await file.exists()) ? await file.json() : {};

  if (!saved.token) {
    saved.token = randomBytes(24).toString("base64url");
    await Bun.write(path, JSON.stringify(saved, null, 2) + "\n");
    await chmod(path, 0o600);
  }

  return { dataDir, dbPath: `${dataDir}/perch.db`, token: saved.token };
}
