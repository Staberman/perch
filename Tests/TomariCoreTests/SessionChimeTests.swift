import Foundation
import TomariCore

func sessionChimeTests() {
    /// The done-chime scenarios, with only the "Sound when done" toggle on.
    func doneSound(_ chime: inout SessionChime, _ message: ServerMessage, previous: PanelSession?, focusedId: String?, sessionAppFrontmost: Bool, at date: Date) -> Bool {
        chime.sound(for: message, previous: previous, focusedId: focusedId, sessionAppFrontmost: sessionAppFrontmost, soundWhenDone: true, soundWhenWaiting: false, at: date) == .done
    }

    func finished(_ session: PanelSession) -> ServerMessage {
        var done = session
        done.state = .done
        return .session(done)
    }

    test("chimes when a working or compacting session finishes") {
        for state in [SessionState.working, .compacting] {
            var chime = SessionChime()
            let before = session(state: state)
            expect(doneSound(&chime,  finished(before), previous: before, focusedId: nil, sessionAppFrontmost: false, at: now), "\(state)")
        }
    }

    test("stays quiet for a snapshot, even of finished sessions") {
        var chime = SessionChime()
        let done = session(state: .done)
        expect(!doneSound(&chime,  .snapshot(sessions: [done], focusedId: nil), previous: nil, focusedId: nil, sessionAppFrontmost: false, at: now))
    }

    test("stays quiet for a session that was already done or unknown") {
        var chime = SessionChime()
        let done = session(state: .done)
        expect(!doneSound(&chime,  .session(done), previous: done, focusedId: nil, sessionAppFrontmost: false, at: now), "done to done")
        expect(!doneSound(&chime,  .session(done), previous: nil, focusedId: nil, sessionAppFrontmost: false, at: now), "new session")
    }

    test("stays quiet for a transition into done from a non-active state") {
        for state in [SessionState.idle, .needsInput, .needsPermission, .error, .ended] {
            var chime = SessionChime()
            let before = session(state: state)
            expect(!doneSound(&chime,  finished(before), previous: before, focusedId: nil, sessionAppFrontmost: false, at: now), "\(state)")
        }
    }

    test("stays quiet for any other state change") {
        var chime = SessionChime()
        let before = session(state: .working)
        var next = before
        next.state = .needsInput
        expect(!doneSound(&chime,  .session(next), previous: before, focusedId: nil, sessionAppFrontmost: false, at: now))
        expect(!doneSound(&chime,  .focus(id: before.id), previous: before, focusedId: before.id, sessionAppFrontmost: false, at: now))
    }

    test("a burst of finishes chimes once, then again after the window") {
        var chime = SessionChime()
        let a = session(state: .working), b = session(state: .working), c = session(state: .working)
        expect(doneSound(&chime,  finished(a), previous: a, focusedId: nil, sessionAppFrontmost: false, at: now))
        expect(!doneSound(&chime,  finished(b), previous: b, focusedId: nil, sessionAppFrontmost: false, at: now + 0.5))
        expect(doneSound(&chime,  finished(c), previous: c, focusedId: nil, sessionAppFrontmost: false, at: now + 1.5))
    }

    test("skips the focused session while Terminal is in front, without using up the burst") {
        var chime = SessionChime()
        let a = session(state: .working), b = session(state: .working)
        expect(!doneSound(&chime,  finished(a), previous: a, focusedId: a.id, sessionAppFrontmost: true, at: now))
        expect(doneSound(&chime,  finished(b), previous: b, focusedId: a.id, sessionAppFrontmost: true, at: now + 0.1), "another session")
        var other = SessionChime()
        expect(doneSound(&other,  finished(a), previous: a, focusedId: a.id, sessionAppFrontmost: false, at: now), "focused but Terminal not in front")
    }

    // Waiting chime.
    func entered(_ state: SessionState, _ session: PanelSession) -> ServerMessage {
        var next = session
        next.state = state
        return .session(next)
    }
    func waitingSound(_ chime: inout SessionChime, _ message: ServerMessage, previous: PanelSession?, focusedId: String? = nil, sessionAppFrontmost: Bool = false, done: Bool = false, waiting: Bool = true, at date: Date = now) -> ChimeSound? {
        chime.sound(for: message, previous: previous, focusedId: focusedId, sessionAppFrontmost: sessionAppFrontmost, soundWhenDone: done, soundWhenWaiting: waiting, at: date)
    }

    test("chimes as waiting when a session starts needing permission or input") {
        for from in [SessionState.working, .compacting, .idle, .done, .error] {
            for into in [SessionState.needsPermission, .needsInput] {
                var chime = SessionChime()
                let before = session(state: from)
                expectEqual(waitingSound(&chime, entered(into, before), previous: before), .waiting)
            }
        }
    }

    test("stays quiet when waiting changes between the two waiting states or is already known") {
        for (from, into) in [(SessionState.needsInput, SessionState.needsPermission), (.needsPermission, .needsInput), (.needsInput, .needsInput)] {
            var chime = SessionChime()
            let before = session(state: from)
            expect(waitingSound(&chime, entered(into, before), previous: before) == nil, "\(from) to \(into)")
        }
    }

    test("a waiting session never chimes for a snapshot or a session without history") {
        var chime = SessionChime()
        let waiting = session(state: .needsPermission)
        expect(waitingSound(&chime, .snapshot(sessions: [waiting], focusedId: nil), previous: nil) == nil, "snapshot")
        expect(waitingSound(&chime, .session(waiting), previous: nil) == nil, "new session")
    }

    test("each chime needs its own toggle") {
        let working = session(state: .working)
        var chime = SessionChime()
        expect(waitingSound(&chime, entered(.needsInput, working), previous: working, done: true, waiting: false) == nil, "waiting off")
        expect(waitingSound(&chime, finished(working), previous: working, done: false, waiting: true) == nil, "done off")
        expectEqual(waitingSound(&chime, finished(working), previous: working, done: true, waiting: false), .done)
        var both = SessionChime()
        expectEqual(waitingSound(&both, entered(.needsInput, working), previous: working, done: true, waiting: true), .waiting)
    }

    test("waiting and done chimes share one burst, and a muted kind does not use it up") {
        let a = session(state: .working), b = session(state: .working), c = session(state: .working)
        var chime = SessionChime()
        expect(waitingSound(&chime, entered(.needsInput, a), previous: a, done: false, waiting: false) == nil, "muted")
        expectEqual(waitingSound(&chime, finished(b), previous: b, done: true, waiting: true), .done)
        expect(waitingSound(&chime, entered(.needsPermission, c), previous: c, done: true, waiting: true, at: now + 0.5) == nil, "same burst")
        expectEqual(waitingSound(&chime, entered(.needsPermission, c), previous: c, done: true, waiting: true, at: now + 1.5), .waiting)
    }

    test("skips the focused waiting session while its app is in front") {
        let a = session(state: .working), b = session(state: .working)
        var chime = SessionChime()
        expect(waitingSound(&chime, entered(.needsInput, a), previous: a, focusedId: a.id, sessionAppFrontmost: true) == nil, "focused")
        expectEqual(waitingSound(&chime, entered(.needsInput, b), previous: b, focusedId: a.id, sessionAppFrontmost: true, at: now + 0.1), .waiting)
        var other = SessionChime()
        expectEqual(waitingSound(&other, entered(.needsInput, a), previous: a, focusedId: a.id, sessionAppFrontmost: false), .waiting)
    }

    test("Terminal and the Claude desktop app are where the user reads a session") {
        expect(SessionChime.isSessionApp("com.apple.Terminal"), "Terminal")
        expect(SessionChime.isSessionApp("com.anthropic.claudefordesktop"), "Claude desktop app")
        expect(!SessionChime.isSessionApp("com.anthropic.claude-code"), "the CLI's own id is not an app window")
        expect(!SessionChime.isSessionApp("com.apple.Safari"), "another app")
        expect(!SessionChime.isSessionApp(nil), "no frontmost app")
    }
}
