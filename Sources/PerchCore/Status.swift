import Foundation

private let dozeAfter: TimeInterval = 5 * 60

extension PanelSession {
    public var needsAttention: Bool {
        state == .needsPermission || state == .needsInput
    }

    /// Doing something or waiting on the user, or finished recently: the strip shows these even unpinned.
    public func isActive(at now: Date) -> Bool {
        guard live else { return false }
        switch state {
        case .working, .compacting, .needsPermission, .needsInput: return true
        case .done, .error: return now.timeIntervalSince(stateSince) <= dozeAfter
        case .idle, .ended: return false
        }
    }

    public func mood(at now: Date) -> Mood {
        switch state {
        case .working: return .working
        case .needsPermission: return .alert
        case .needsInput: return .asking
        case .compacting: return .compacting
        case .error: return .error
        case .ended: return .sleeping
        case .idle: return now.timeIntervalSince(stateSince) > dozeAfter ? .sleeping : .idle
        case .done: return now.timeIntervalSince(stateSince) > dozeAfter ? .sleeping : .finished
        }
    }

    public func statusLine(at now: Date) -> String {
        switch state {
        case .working: return activity ?? "working"
        case .needsPermission: return "needs permission"
        case .needsInput: return activity ?? "waiting for you"
        case .compacting: return "compacting"
        case .error: return activity.map { "error · \($0)" } ?? "error"
        case .idle, .done: return "\(state.rawValue) · \(ago(since: stateSince, now: now))"
        case .ended: return "closed · \(ago(since: stateSince, now: now))"
        }
    }
}

public func ago(since: Date, now: Date) -> String {
    let s = max(0, Int(now.timeIntervalSince(since)))
    switch s {
    case ..<5: return "now"
    case ..<60: return "\(s)s"
    case ..<3600: return "\(s / 60)m"
    case ..<86400: return "\(s / 3600)h"
    default: return "\(s / 86400)d"
    }
}
