import { expect, test } from "bun:test";
import { perchJobs, plist } from "./launchd.ts";

const paths = { binDir: "/Users/me/Library/Application Support/perch/bin", logDir: "/Users/me/Library/Logs/perch" };

test("the agent job runs `perch agent`, on the LAN only when asked", () => {
  const [agent] = perchJobs(paths, { lan: false });
  expect(agent!.label).toBe("com.elrincondeldev.perch.agent");
  expect(agent!.program).toEqual([`${paths.binDir}/perch`, "agent"]);
  expect(agent!.keepAlive).toBe("always");
  expect(perchJobs(paths, { lan: true })[0]!.program).toEqual([`${paths.binDir}/perch`, "agent", "--lan"]);
});

test("the overlay job restarts after a crash but stays quit after Quit Perch", () => {
  const [, overlay] = perchJobs(paths, { lan: false });
  expect(overlay!.label).toBe("com.elrincondeldev.perch.overlay");
  expect(overlay!.program).toEqual([`${paths.binDir}/perch-overlay`]);
  expect(overlay!.keepAlive).toBe("after-crash");
});

test("renders a plist with escaped values and the right KeepAlive", () => {
  const [agent, overlay] = perchJobs({ ...paths, binDir: "/tmp/a&b" }, { lan: false });
  const agentPlist = plist(agent!);
  expect(agentPlist).toContain("<string>/tmp/a&amp;b/perch</string>");
  expect(agentPlist).toContain("<key>KeepAlive</key><true/>");
  expect(agentPlist).toContain("<key>RunAtLoad</key><true/>");
  expect(agentPlist).toContain(`<string>${paths.logDir}/agent.log</string>`);
  expect(agentPlist).toMatch(/<key>PATH<\/key><string>[^<]*\/opt\/homebrew\/bin/);
  expect(plist(overlay!)).toContain("<key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>");
});
