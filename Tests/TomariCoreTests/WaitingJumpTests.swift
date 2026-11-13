import Foundation
import TomariCore

func waitingJumpTests() {
    func waiting(_ state: SessionState = .needsPermission, since seconds: TimeInterval, live: Bool = true) -> PanelSession {
        session(state: state, live: live, stateSince: now - seconds)
    }

    test("picks the session that has waited longest, for either waiting state") {
        let newer = waiting(.needsInput, since: 10)
        let oldest = waiting(.needsPermission, since: 300)
        let middle = waiting(.needsInput, since: 60)
        expectEqual(WaitingJump.target(in: [newer, oldest, middle], focusedId: nil), oldest.id)
    }

    test("goes to the next waiting session after the focused one") {
        let a = waiting(since: 300), b = waiting(since: 200), c = waiting(since: 100)
        expectEqual(WaitingJump.target(in: [c, a, b], focusedId: a.id), b.id)
        expectEqual(WaitingJump.target(in: [c, a, b], focusedId: b.id), c.id)
    }

    test("wraps around from the last waiting session to the first") {
        let a = waiting(since: 300), b = waiting(since: 100)
        expectEqual(WaitingJump.target(in: [a, b], focusedId: b.id), a.id)
    }

    test("a lone waiting session that is focused stays the target") {
        let only = waiting(since: 50)
        expectEqual(WaitingJump.target(in: [only], focusedId: only.id), only.id)
    }

    test("a focused session that is not waiting does not shift the order") {
        let busy = session(state: .working)
        let a = waiting(since: 300), b = waiting(since: 100)
        expectEqual(WaitingJump.target(in: [busy, a, b], focusedId: busy.id), a.id)
    }

    test("ignores sessions that are not waiting or not live") {
        let working = session(state: .working, stateSince: now - 900)
        let done = session(state: .done, stateSince: now - 900)
        let dead = waiting(since: 900, live: false)
        let real = waiting(since: 5)
        expectEqual(WaitingJump.target(in: [working, done, dead, real], focusedId: nil), real.id)
    }

    test("returns nil when nothing is waiting") {
        expect(WaitingJump.target(in: [], focusedId: nil) == nil, "empty")
        expect(WaitingJump.target(in: [session(state: .working), waiting(since: 1, live: false)], focusedId: nil) == nil, "none eligible")
    }
}
