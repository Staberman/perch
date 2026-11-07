import Foundation
import PerchCore

func statusTests() {
    test("maps states to moods") {
        expectEqual(session(state: .working).mood(at: now), .working)
        expectEqual(session(state: .needsPermission).mood(at: now), .alert)
        expectEqual(session(state: .needsInput).mood(at: now), .asking)
        expectEqual(session(state: .compacting).mood(at: now), .compacting)
        expectEqual(session(state: .error).mood(at: now), .error)
        expectEqual(session(state: .ended).mood(at: now), .sleeping)
    }

    test("a finished session dozes off after five minutes") {
        expectEqual(session(state: .done, stateSince: now - 60).mood(at: now), .idle)
        expectEqual(session(state: .idle, stateSince: now - 60).mood(at: now), .idle)
        expectEqual(session(state: .done, stateSince: now - 6 * 60).mood(at: now), .sleeping)
    }

    test("only permission and input requests need the user") {
        let needy = SessionState.allCases.filter { session(state: $0).needsAttention }
        expectEqual(needy, [.needsPermission, .needsInput])
    }

    test("ago") {
        expectEqual(ago(since: now, now: now), "now")
        expectEqual(ago(since: now + 30, now: now), "now")
        expectEqual(ago(since: now - 42, now: now), "42s")
        expectEqual(ago(since: now - 5 * 60, now: now), "5m")
        expectEqual(ago(since: now - 3 * 3600, now: now), "3h")
        expectEqual(ago(since: now - 2 * 86400, now: now), "2d")
    }

    test("statusLine") {
        expectEqual(session(state: .working, activity: "Bash: npm test").statusLine(at: now), "Bash: npm test")
        expectEqual(session(state: .working).statusLine(at: now), "working")
        expectEqual(session(state: .done, stateSince: now - 5 * 60).statusLine(at: now), "done · 5m")
        expectEqual(session(state: .idle, stateSince: now - 42).statusLine(at: now), "idle · 42s")
        expectEqual(session(state: .ended, live: false, stateSince: now - 2 * 3600).statusLine(at: now), "closed · 2h")
        expectEqual(
            session(state: .needsPermission, activity: "Claude needs your permission to use Bash").statusLine(at: now),
            "needs permission"
        )
        expectEqual(session(state: .needsInput).statusLine(at: now), "waiting for you")
        expectEqual(session(state: .needsInput, activity: "Plan ready").statusLine(at: now), "Plan ready")
        expectEqual(session(state: .compacting).statusLine(at: now), "compacting")
        expectEqual(session(state: .error).statusLine(at: now), "error")
        expectEqual(session(state: .error, activity: "rate limited").statusLine(at: now), "error · rate limited")
    }
}
