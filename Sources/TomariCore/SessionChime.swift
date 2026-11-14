import Foundation

/// Which chime to play.
public enum ChimeSound: Equatable, Sendable {
    case done
    case waiting
}

/// Decides when a session earns a chime and which one: "done" for a live transition from working
/// or compacting to done, "waiting" for a transition into needs_permission or needs_input from any
/// other state. Each kind needs its own toggle on, the chimes share one burst window, and neither
/// plays while the user is already looking at the session (it is focused and Terminal or the Claude desktop app is in front).
public struct SessionChime: Sendable {
    /// Sessions changing within this window of a chime share it.
    public static let burst: TimeInterval = 1

    private var lastChime: Date?

    public init() {}

    /// `previous` is the session as it was before `message` was applied.
    public mutating func sound(
        for message: ServerMessage,
        previous: PanelSession?,
        focusedId: String?,
        sessionAppFrontmost: Bool,
        soundWhenDone: Bool,
        soundWhenWaiting: Bool,
        at now: Date
    ) -> ChimeSound? {
        guard case .session(let session) = message, let before = previous?.state else { return nil }
        let kind: ChimeSound
        if session.state == .done, before == .working || before == .compacting {
            guard soundWhenDone else { return nil }
            kind = .done
        } else if session.needsAttention, !before.isWaiting {
            guard soundWhenWaiting else { return nil }
            kind = .waiting
        } else {
            return nil
        }
        if sessionAppFrontmost && session.id == focusedId { return nil }
        if let lastChime, now.timeIntervalSince(lastChime) < Self.burst { return nil }
        lastChime = now
        return kind
    }
}

private extension SessionState {
    var isWaiting: Bool { self == .needsPermission || self == .needsInput }
}
