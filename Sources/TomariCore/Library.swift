import Foundation

/// The + menu's sessions under one agent's heading.
public struct LibraryGroup: Equatable, Sendable {
    /// "claude", "codex", or another agent's name.
    public let agent: String
    public let badge: AgentBadge
    public let title: String
    public let entries: [LibraryEntry]
}

extension LibraryEntry {
    /// The last component of the folder the session ran in.
    public var folder: String {
        (cwd as NSString).lastPathComponent
    }

    /// The name as the + menu shows it: cut so a long one doesn't widen the whole menu.
    public var menuName: String { shortened(name, to: 34) }

    /// The folder as the + menu shows it, after the name.
    public var menuFolder: String { shortened(folder, to: 16) }

    /// Whether every word of `query` is in the session's name or folder, ignoring case and accents.
    /// An empty query matches everything.
    public func matches(_ query: String) -> Bool {
        let words = query.split(whereSeparator: \.isWhitespace)
        guard !words.isEmpty else { return true }
        let haystack = "\(name) \(folder)"
        return words.allSatisfy { haystack.range(of: $0, options: [.caseInsensitive, .diacriticInsensitive]) != nil }
    }
}

/// `text` on one line, cut to `limit` characters with an ellipsis at the end.
func shortened(_ text: String, to limit: Int) -> String {
    let line = text.split(whereSeparator: \.isWhitespace).joined(separator: " ")
    return line.count <= limit ? line : line.prefix(limit - 1).trimmingCharacters(in: .whitespaces) + "…"
}

/// Claude Code's sessions, then Codex's, then any other agent's, each keeping the order it was given in.
/// An agent with no sessions has no group.
public func libraryGroups(_ entries: [LibraryEntry]) -> [LibraryGroup] {
    var order: [String] = ["claude", "codex"]
    var byAgent: [String: [LibraryEntry]] = [:]
    for entry in entries {
        let agent = entry.agent ?? "claude"
        if !order.contains(agent) { order.append(agent) }
        byAgent[agent, default: []].append(entry)
    }
    return order.compactMap { agent in
        guard let entries = byAgent[agent], !entries.isEmpty else { return nil }
        let title = agent == "claude" ? "Claude" : agent == "codex" ? "Codex" : agent
        return LibraryGroup(agent: agent, badge: AgentBadge(agent: agent), title: title, entries: entries)
    }
}

/// What the + panel shows: one tab per agent, the sessions of the chosen tab that match the search, and which of
/// them is selected for Return. Pure, so the panel only draws it.
public struct LibraryBrowser: Equatable, Sendable {
    public let groups: [LibraryGroup]
    public private(set) var tab: Int
    public private(set) var query = ""
    /// Index into `visible`; nil when nothing matches.
    public private(set) var selection: Int?

    /// Opens on `preferredAgent`'s tab when it has sessions, else on the first.
    public init(entries: [LibraryEntry], preferredAgent: String? = nil) {
        groups = libraryGroups(entries)
        tab = groups.firstIndex { $0.agent == preferredAgent } ?? 0
        selection = nil
        resetSelection()
    }

    public var agent: String? { groups.indices.contains(tab) ? groups[tab].agent : nil }

    /// The chosen tab's sessions that match the search, most recent first.
    public var visible: [LibraryEntry] { matches(inTab: tab) }

    public var selected: LibraryEntry? { selection.map { visible[$0] } }

    /// How many sessions of a tab match the search: its label, so a match in the other tab shows.
    public func count(inTab index: Int) -> Int { matches(inTab: index).count }

    public mutating func select(tab index: Int) {
        guard groups.indices.contains(index) else { return }
        tab = index
        resetSelection()
    }

    /// The next tab, wrapping around.
    public mutating func nextTab() {
        guard !groups.isEmpty else { return }
        select(tab: (tab + 1) % groups.count)
    }

    public mutating func search(_ text: String) {
        query = text
        resetSelection()
    }

    /// Moves the selection by `delta` rows, stopping at either end.
    public mutating func move(by delta: Int) {
        let count = visible.count
        guard count > 0 else { return selection = nil }
        selection = min(max((selection ?? 0) + delta, 0), count - 1)
    }

    public mutating func select(row: Int) {
        if visible.indices.contains(row) { selection = row }
    }

    private func matches(inTab index: Int) -> [LibraryEntry] {
        guard groups.indices.contains(index) else { return [] }
        return groups[index].entries.filter { $0.matches(query) }
    }

    private mutating func resetSelection() {
        selection = visible.isEmpty ? nil : 0
    }
}
