import Foundation

// Mirrors claude-panel's shared/protocol.ts; keep the two compatible.

public let panelPort = 7778

public enum SessionState: String, CaseIterable, Sendable, Decodable {
    case idle // started, no prompt yet
    case working
    case needsPermission = "needs_permission"
    case needsInput = "needs_input"
    case compacting
    case done
    case error
    case ended // process gone; the session itself can be reopened

    /// Unknown states from a newer agent read as idle instead of failing the whole message.
    public init(from decoder: Decoder) throws {
        self = SessionState(rawValue: try decoder.singleValueContainer().decode(String.self)) ?? .idle
    }
}

public struct SessionIcon: Equatable, Sendable, Decodable {
    public var character: String
    public var color: String

    public init(character: String, color: String) {
        self.character = character
        self.color = color
    }

    public static let `default` = SessionIcon(character: "default", color: "#d97757")
}

public struct PanelSession: Equatable, Identifiable, Sendable {
    public var id: String
    public var name: String
    public var cwd: String
    public var state: SessionState
    public var activity: String?
    /// The Claude process is running.
    public var live: Bool
    public var stateSince: Date
    public var pinned: Bool
    public var position: Int?
    public var icon: SessionIcon

    public init(
        id: String, name: String, cwd: String, state: SessionState, activity: String?, live: Bool,
        stateSince: Date, pinned: Bool, position: Int?, icon: SessionIcon
    ) {
        self.id = id
        self.name = name
        self.cwd = cwd
        self.state = state
        self.activity = activity
        self.live = live
        self.stateSince = stateSince
        self.pinned = pinned
        self.position = position
        self.icon = icon
    }
}

extension PanelSession: Decodable {
    private enum Keys: String, CodingKey {
        case id, name, cwd, state, activity, live, stateSince, pinned, position, icon
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: Keys.self)
        let stateSinceEpochMs = try c.decode(Double.self, forKey: .stateSince)
        self.init(
            id: try c.decode(String.self, forKey: .id),
            name: try c.decode(String.self, forKey: .name),
            cwd: try c.decode(String.self, forKey: .cwd),
            state: try c.decode(SessionState.self, forKey: .state),
            activity: try c.decodeIfPresent(String.self, forKey: .activity),
            live: try c.decode(Bool.self, forKey: .live),
            stateSince: Date(timeIntervalSince1970: stateSinceEpochMs / 1000),
            pinned: try c.decode(Bool.self, forKey: .pinned),
            position: try c.decodeIfPresent(Int.self, forKey: .position),
            icon: try c.decode(SessionIcon.self, forKey: .icon)
        )
    }
}

public enum ServerMessage: Equatable, Sendable {
    case snapshot(sessions: [PanelSession], focusedId: String?)
    case session(PanelSession)
    case removed(id: String)
    /// The session in front in the desktop app.
    case focus(id: String?)
    case error(message: String)

    /// Nil for malformed or unknown messages.
    public static func parse(_ text: String) -> ServerMessage? {
        let data = Data(text.utf8)
        let decoder = JSONDecoder()
        guard let type = try? decoder.decode(Envelope.self, from: data).type else { return nil }
        switch type {
        case "snapshot":
            guard let m = try? decoder.decode(Snapshot.self, from: data) else { return nil }
            return .snapshot(sessions: m.sessions.compactMap(\.value), focusedId: m.focusedId)
        case "session":
            return (try? decoder.decode(SessionChange.self, from: data)).map { .session($0.session) }
        case "removed":
            return (try? decoder.decode(Removed.self, from: data)).map { .removed(id: $0.id) }
        case "focus":
            return (try? decoder.decode(Focus.self, from: data)).map { .focus(id: $0.id) }
        case "error":
            return (try? decoder.decode(Failure.self, from: data)).map { .error(message: $0.message) }
        default:
            return nil
        }
    }

    private struct Envelope: Decodable { let type: String }
    private struct Snapshot: Decodable { let sessions: [Lenient<PanelSession>]; let focusedId: String? }
    private struct SessionChange: Decodable { let session: PanelSession }
    private struct Removed: Decodable { let id: String }
    private struct Focus: Decodable { let id: String? }
    private struct Failure: Decodable { let message: String }
}

/// Lets one unreadable session be skipped instead of failing the whole snapshot.
private struct Lenient<T: Decodable>: Decodable {
    let value: T?
    init(from decoder: Decoder) throws { value = try? T(from: decoder) }
}

public enum ClientMessage: Equatable, Sendable {
    case open(id: String)

    public var json: String {
        switch self {
        case .open(let id):
            let body = try! JSONSerialization.data(withJSONObject: ["type": "open", "id": id], options: [.sortedKeys])
            return String(decoding: body, as: UTF8.self)
        }
    }
}
