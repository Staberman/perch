# Perch

<p align="center">
  <img src="images/creatures.gif" alt="Eight pixel-art creatures, one per session state: working, needs permission, asking you, compacting, done, asleep, error and closed" width="100%">
</p>

A floating strip on the edge of your Mac's screen with one animated pixel-art creature per Claude Code session. Each creature shows what its session is doing, and the ones waiting for you are hard to miss. Click a creature and its session opens in the Claude desktop app.

> **Not an official Anthropic project.** It is not affiliated with or endorsed by Anthropic. "Claude" is a trademark of Anthropic, PBC.

> **Early development.** Expect rough edges. macOS 14 or newer only.

## Install

```bash
npx @elrincondeldev/perch setup
```

That's all: the strip appears on the right edge with one creature per running session, and it comes back at every login. Setup:

- copies Perch's binaries into `~/Library/Application Support/perch/bin`;
- adds hooks to `~/.claude/settings.json`, after backing it up, so Claude Code reports each event to Perch's agent;
- starts the agent and the strip now and at every login, as LaunchAgents;
- replaces [claude-panel](https://github.com/elrincondeldev/claude-panel)'s agent if you have it, keeping its pinned sessions, their looks and its pairing token.

```bash
npx @elrincondeldev/perch status             # what's installed and running
npx @elrincondeldev/perch uninstall          # remove everything; asks before deleting pins and icons
npx @elrincondeldev/perch setup --pi         # also let a claude-panel Raspberry Pi connect over your network
```

You need the Claude desktop app (sessions in its Code tab), the Claude Code CLI 2.1.285 or newer, and Node.js 18 or newer for `npx`.

## Features

- **One creature per session**: pinned sessions first, then running ones by name. Each one animates its session's state: working, needs permission, asking you, compacting, done, error or closed. Finished sessions fall asleep after five minutes.
- **Hard to miss when it needs you**: a permission request blinks the creature's tile in orange; a question rings it in orange.
- **Hover** for the session's name and status, e.g. `Bash: npm test` or `done · 5m`.
- **Click** to open the session in the Claude desktop app, even one the app has stopped. The session in front is ringed in white.
- **Right-click** (or control-click) to pin or unpin the session and pick its character and color.
- **Stays out of the way**: the strip floats over every Space and full-screen app and never takes focus from the app you're using.
- **Menu bar item** to show or hide the strip, move it to the left or right edge, and see how many sessions are waiting for you. Quit Perch there; it starts again at your next login.

## How it works

```
Claude Code ─ hooks ─▶ perch agent ◀─ WebSocket (127.0.0.1:7778, token) ─ perch-overlay ─ menu bar
claude agents ─ poll ─▶  └ SQLite: pins, icons                       └ claude-panel Pi (with --pi)
```

- **`perch`** (`agent/`, Bun and TypeScript compiled into one binary) holds the CLI and the agent. The agent tracks every session's state from Claude Code hooks and `claude agents --json`, keeps pins and icons in SQLite, and opens sessions in the desktop app. It listens on 127.0.0.1 only, unless you set it up with `--pi`.
- **`perch-overlay`** (`Sources/`, Swift) is a native AppKit and Core Animation app that runs as an accessory: no Dock icon, just the strip and a menu bar item. It costs about 0.5 % of one CPU core and 13 MB of memory while it animates.
- **`shared/protocol.ts`** is the contract between them, and the Pi panel speaks it too.

| What the agent reads from Claude | Used for | Documented? |
|---|---|---|
| Hooks in `~/.claude/settings.json` | Instant state changes | Yes |
| `claude agents --json` | Names, who is alive, corrections for missed hooks | Yes |
| `claude --desktop --resume <id>` | Opening a session the desktop app doesn't know | Yes |
| `claude://code/continue?session=local_…` | Opening any desktop-app session, running or stopped | No |
| `~/Library/Application Support/Claude/claude-code-sessions/` | The app's sessions, and their `local_…` ids | No |
| `setFocusedSession` in `~/Library/Logs/Claude/main.log` | Which session is in front | No |

If a Claude update breaks an undocumented source, only the feature it feeds stops working.

## Customizing the creatures

The characters are 16×16 text templates in [`Sources/PerchCore/Resources/characters.json`](Sources/PerchCore/Resources/characters.json):

| Field | Meaning |
|---|---|
| `body` | 16 rows of 16 cells: `B` body (the session's color), `D` darker, `L` lighter, `F` face plate, `P` pink, `.` empty |
| `walk` | Optional rows that replace the body from `row` down on alternate frames while the session works |
| `eyes` | Top-left corners of the two 2×2 eyes, which blink, close and squint on their own |
| `eyeColor` | Optional `#rrggbb` |

After editing, check the templates with `swift run PerchCoreTests` and rebuild.

## Development

You need the Command Line Tools for Xcode (`xcode-select --install`) and [Bun](https://bun.sh) 1.3 or newer.

```bash
(cd agent && bun install)
bun test agent npm             # agent, CLI and npm launcher
swift run PerchCoreTests       # protocol, session list, status rules, sprites and layout
swift build                    # debug overlay: .build/debug/perch-overlay
bun scripts/release.ts --arch arm64      # npm packages in dist/npm
dist/npm/perch-darwin-arm64/bin/perch setup   # install that build
```

The Command Line Tools for Xcode 15 ship without XCTest, so the Swift tests are a plain executable that exits non-zero when a check fails.

Pushing a `v*` tag runs `.github/workflows/release.yml`: it tests, builds for Apple Silicon and Intel, publishes the three npm packages through npm's Trusted Publishing, with no token, and attaches the binaries to a GitHub release. Pull requests that touch what ships run the same build without publishing.

## Privacy

- Everything stays on your Mac: the overlay only talks to the agent on 127.0.0.1, and the agent only listens there unless you choose `--pi`. No telemetry.
- The WebSocket needs the pairing token in `~/Library/Application Support/perch/config.json`, and accepts only `open`, `pin`, `icon` and `library`, with validated arguments.
- Perch keeps its data in `~/Library/Application Support/perch/`, its logs in `~/Library/Logs/perch/`, and the strip's edge in the `com.elrincondeldev.perch` defaults.
- The hover label can show tool details such as a shell command, so anyone who can see your screen can read them.

## Roadmap

- Homebrew: `brew install elrincondeldev/tap/perch`, from the same release binaries.
- Drag the strip to any edge, collapse it, global shortcuts to open sessions, and notifications when a session needs you.

## License

[MIT](LICENSE)
