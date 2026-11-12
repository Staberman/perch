import { expect, test } from "bun:test";
import { tomariJobs, plist } from "./launchd.ts";

const paths = { binDir: "/Users/me/Library/Application Support/tomari/bin", logDir: "/Users/me/Library/Logs/tomari" };

test("the agent job runs `tomari agent`, on the LAN only when asked", () => {
  const [agent] = tomariJobs(paths, { lan: false });
  expect(agent!.label).toBe("com.elrincondeldev.tomari.agent");
  expect(agent!.program).toEqual([`${paths.binDir}/tomari`, "agent"]);
  expect(agent!.keepAlive).toBe("always");
  expect(tomariJobs(paths, { lan: true })[0]!.program).toEqual([`${paths.binDir}/tomari`, "agent", "--lan"]);
});

test("the overlay job restarts after a crash but stays quit after Quit Tomari", () => {
  const [, overlay] = tomariJobs(paths, { lan: false });
  expect(overlay!.label).toBe("com.elrincondeldev.tomari.overlay");
  expect(overlay!.program).toEqual([`${paths.binDir}/tomari-overlay`]);
  expect(overlay!.keepAlive).toBe("after-crash");
});

test("renders a plist with escaped values and the right KeepAlive", () => {
  const [agent, overlay] = tomariJobs({ ...paths, binDir: "/tmp/a&b" }, { lan: false });
  const agentPlist = plist(agent!);
  expect(agentPlist).toContain("<string>/tmp/a&amp;b/tomari</string>");
  expect(agentPlist).toContain("<key>KeepAlive</key><true/>");
  expect(agentPlist).toContain("<key>RunAtLoad</key><true/>");
  expect(agentPlist).toContain(`<string>${paths.logDir}/agent.log</string>`);
  expect(agentPlist).toMatch(/<key>PATH<\/key><string>[^<]*\/opt\/homebrew\/bin/);
  expect(plist(overlay!)).toContain("<key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>");
});
