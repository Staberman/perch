/**
 * Two servers, both on loopback: hooks, and the panel WebSocket behind the pairing token.
 * Keeping them apart means a panel client can never inject hook events.
 */
import { timingSafeEqual } from "node:crypto";
import { basename } from "node:path";
import { BACKGROUND_KIND, type LibraryEntry, type ServerMessage } from "../../shared/protocol.ts";
import { desktopSessionsLister, type DesktopSession } from "./desktop-sessions.ts";
import type { SessionHub } from "./hub.ts";
import { openSession, openTerminalTab, type OpenOptions, type OpenResult } from "./open-session.ts";
import { parseClientMessage } from "./protocol-guard.ts";
import { stopSession } from "./stop-session.ts";
import type { HookEvent, HookOrigin } from "./state.ts";
import { codexAdmission, codexPidResolver, codexThreads, type CodexThread } from "./codex.ts";
import { PID_HEADER } from "./hooks-config.ts";
import { FrontApp } from "./front-app.ts";

export interface ServerOptions {
  hub: SessionHub;
  /** Where clients' reports of the app in front are kept. */
  front?: FrontApp;
  token: string;
  hookPort: number;
  panelPort: number;
  /** Replaceable so tests don't open real sessions or tabs, or read the real desktop app. */
  open?: (id: string, options?: OpenOptions) => Promise<OpenResult>;
  terminal?: () => Promise<OpenResult>;
  stop?: (id: string) => Promise<OpenResult>;
  desktopSessions?: () => Promise<DesktopSession[]>;
  /** Maps the pid a Codex hook reports to the Codex process; replaceable so tests don't run `ps`. */
  codexPid?: (reported: number) => Promise<number | null>;
  /** Whether a Codex event belongs to a session worth tracking; replaceable so tests don't need rollouts. */
  admitCodex?: (event: HookEvent, known: boolean) => Promise<boolean>;
  /** Codex's threads, running or not; replaceable so tests don't read Codex's database. */
  codexLibrary?: () => Promise<CodexThread[]>;
}

const TOPIC = "panel";
const LIBRARY_SIZE = 100;

export function startServers({
  hub,
  front = new FrontApp(),
  token,
  hookPort,
  panelPort,
  open = openSession,
  terminal = openTerminalTab,
  stop = stopSession,
  desktopSessions = desktopSessionsLister(),
  codexPid = codexPidResolver(),
  admitCodex = codexAdmission(),
  codexLibrary = () => codexThreads(),
}: ServerOptions) {
  /**
   * The Claude app's sessions and Codex's threads, plus the live ones the agent sees, e.g. in a terminal; a desktop
   * or Codex entry wins a duplicate. Most recent first, up to LIBRARY_SIZE per agent.
   */
  async function library(): Promise<LibraryEntry[]> {
    const [desktop, codex] = await Promise.all([desktopSessions(), codexLibrary()]);
    const listed = new Set([...desktop.map((s) => s.sessionId), ...codex.map((t) => t.id)]);
    const entries: LibraryEntry[] = desktop
      .filter((s) => !s.archived)
      .map((s) => ({
        id: s.sessionId,
        name: s.title ?? hub.get(s.sessionId)?.name ?? basename(s.cwd),
        cwd: s.cwd,
        lastActivityAt: s.lastActivityAt,
        pinned: hub.get(s.sessionId)?.pinned ?? false,
      }));
    for (const thread of codex) {
      entries.push({
        id: thread.id,
        name: thread.name || hub.get(thread.id)?.name || basename(thread.cwd),
        cwd: thread.cwd,
        lastActivityAt: thread.lastActivityAt,
        pinned: hub.get(thread.id)?.pinned ?? false,
        agent: "codex",
      });
    }
    for (const entry of hub.liveEntries()) if (!listed.has(entry.id)) entries.push(entry);
    const perAgent = new Map<string, number>();
    return entries
      .sort((a, b) => b.lastActivityAt - a.lastActivityAt)
      .filter((entry) => {
        const agent = entry.agent ?? "claude";
        const count = (perAgent.get(agent) ?? 0) + 1;
        perAgent.set(agent, count);
        return count <= LIBRARY_SIZE;
      });
  }

  /** Lets the panel pin a desktop session or Codex thread whose process isn't running, so the agent never saw it. */
  async function adoptFromLibrary(id: string) {
    const session = (await desktopSessions()).find((s) => s.sessionId === id);
    if (session) return hub.adopt(session.sessionId, session.title, session.cwd, session.lastActivityAt);
    const thread = (await codexLibrary()).find((t) => t.id === id);
    if (thread) hub.adopt(thread.id, thread.name || null, thread.cwd, thread.lastActivityAt, "codex");
  }

  /** Codex sessions already logged as held back, so each one is said once. */
  const heldBack = new Set<string>();

  /** Sessions with a stop under way: a second request meanwhile would run `claude stop` twice. */
  const stopping = new Set<string>();

  const hookServer = Bun.serve({
    hostname: "127.0.0.1",
    port: hookPort,
    async fetch(req) {
      const { pathname } = new URL(req.url);
      if (req.method !== "POST" || (pathname !== "/hook" && pathname !== "/hook/codex")) return new Response("not found", { status: 404 });
      try {
        const event = (await req.json()) as HookEvent;
        if (typeof event?.session_id === "string" && typeof event.hook_event_name === "string") {
          const origin: HookOrigin = {};
          if (pathname === "/hook/codex") {
            if (!(await admitCodex(event, hub.has(event.session_id)))) {
              if (!heldBack.has(event.session_id) && event.hook_event_name !== "SessionStart" && event.hook_event_name !== "SessionEnd") {
                if (heldBack.size > 200) heldBack.clear();
                heldBack.add(event.session_id);
                console.log(`codex ${event.session_id.slice(0, 8)}: not shown yet, it has no rollout (an internal Codex session, or one still starting)`);
              }
              return new Response(null, { status: 204 });
            }
            origin.agent = "codex";
            const reported = Number(req.headers.get(PID_HEADER));
            const pid = Number.isSafeInteger(reported) && reported > 1 ? await codexPid(reported) : null;
            if (pid !== null) origin.pid = pid;
          }
          hub.handleHook(event, origin);
        }
      } catch {
        return new Response("bad json", { status: 400 });
      }
      return new Response(null, { status: 204 }); // an empty 2xx tells Claude Code "no decision"
    },
  });

  const panelServer = Bun.serve<{ reportedFront: boolean }>({
    hostname: "127.0.0.1",
    port: panelPort,
    fetch(req, server) {
      const url = new URL(req.url);
      if (url.pathname === "/health") return Response.json({ ok: true, sessions: hub.snapshot().length });
      if (url.pathname !== "/ws") return new Response("not found", { status: 404 });
      if (!sameSecret(url.searchParams.get("token"), token)) return new Response("unauthorized", { status: 401 });
      if (server.upgrade(req, { data: { reportedFront: false } })) return;
      return new Response("expected a WebSocket", { status: 400 });
    },
    websocket: {
      maxPayloadLength: 4 * 1024,
      open(ws) {
        ws.subscribe(TOPIC);
        send(ws, { type: "snapshot", sessions: hub.snapshot(), focusedId: hub.focusedId });
      },
      async message(ws, raw) {
        // An async handler's rejection is unhandled and kills the agent: answer it instead.
        try {
          const msg = parseClientMessage(String(raw));
          if (!msg) return send(ws, { type: "error", message: "invalid message" });
          if (msg.type === "library") return send(ws, { type: "library", sessions: await library() });
          if (msg.type === "frontApp") {
            ws.data.reportedFront = true;
            front.set(msg.app);
            return;
          }
          if (msg.type === "terminal") {
            const result = await terminal();
            if (!result.ok) send(ws, { type: "error", message: result.error });
            return;
          }
          if (!hub.has(msg.id) && msg.type !== "open" && msg.type !== "stop") await adoptFromLibrary(msg.id);
          if (!hub.has(msg.id)) return send(ws, { type: "error", message: "unknown session" });

          switch (msg.type) {
            case "open": {
              const session = hub.get(msg.id);
              const result = await open(msg.id, {
                cwd: session?.cwd,
                kind: session?.kind,
                name: hub.titleOf(msg.id) ?? undefined,
                agent: session?.agent,
                ...hub.openContext(msg.id),
              });
              console.error(openLogLine(msg.id, result));
              // The desktop log confirms focus a moment later; show it right away.
              if (result.ok) hub.setFocused(msg.id);
              else send(ws, { type: "error", message: result.error });
              break;
            }
            case "stop": {
              const session = hub.get(msg.id);
              if (!session?.live || session.kind !== BACKGROUND_KIND) {
                return send(ws, { type: "error", message: "not a running background session" });
              }
              if (stopping.has(msg.id)) return send(ws, { type: "error", message: "already stopping" });
              stopping.add(msg.id);
              try {
                const result = await stop(msg.id);
                if (result.ok) hub.endSession(msg.id);
                else send(ws, { type: "error", message: result.error });
              } finally {
                stopping.delete(msg.id);
              }
              break;
            }
            case "pin":
              hub.setPinned(msg.id, msg.pinned);
              break;
            case "icon":
              hub.setIcon(msg.id, msg.icon);
              break;
          }
        } catch (error) {
          console.error(`panel message failed: ${error instanceof Error ? error.message : String(error)}`);
          send(ws, { type: "error", message: "internal error" }); // details stay in the log
        }
      },
      close(ws) {
        ws.unsubscribe(TOPIC);
        if (ws.data.reportedFront) front.set("unknown"); // its report is stale now; ask Terminal again until someone says
      },
    },
  });

  const unsubscribe = hub.subscribe((change) => panelServer.publish(TOPIC, JSON.stringify(change satisfies ServerMessage)));

  return {
    hookServer,
    panelServer,
    stop() {
      unsubscribe();
      hookServer.stop(true);
      panelServer.stop(true);
    },
  };
}

/**
 * One log line per open request, to tell why a session didn't come to the front. No prompt text, and no
 * paths: an error can hold local paths, so any word with a slash becomes `<path>`.
 */
export function openLogLine(id: string, result: OpenResult): string {
  if (result.ok) return `open ${id.slice(0, 8)}: ok`;
  const firstLine = result.error.split("\n")[0] ?? "";
  return `open ${id.slice(0, 8)}: ${firstLine.replace(/\S*\/\S*/g, "<path>").slice(0, 120)}`;
}

function send(ws: { send(data: string): unknown }, message: ServerMessage) {
  ws.send(JSON.stringify(message));
}

/** Constant-time, so response timing doesn't leak the token. */
function sameSecret(given: string | null, expected: string) {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
