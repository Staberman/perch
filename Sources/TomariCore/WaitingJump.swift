import Foundation

/// Picks the session the "jump to waiting session" hotkey should open.
public enum WaitingJump {
    /// Live sessions waiting for the user are ordered by how long they have waited, longest first.
    /// If the focused session is one of them the target is the next one after it, wrapping around,
    /// so repeated presses visit every waiting session. Nil when nothing is waiting.
    public static func target(in sessions: [PanelSession], focusedId: String?) -> String? {
        let waiting = sessions.filter { $0.live && $0.needsAttention }.sorted {
            ($0.stateSince, $0.id) < ($1.stateSince, $1.id)
        }
        guard let first = waiting.first else { return nil }
        guard let focused = waiting.firstIndex(where: { $0.id == focusedId }) else { return first.id }
        return waiting[(focused + 1) % waiting.count].id
    }
}
