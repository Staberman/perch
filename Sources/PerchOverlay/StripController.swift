import AppKit
import Observation
import PerchCore

@MainActor
final class StripController {
    /// What sits in one cell of the strip: a session's creature, or the add button after the last one.
    private enum Cell: Equatable {
        case session(String)
        case add
    }

    private let link: AgentLink
    private let panel = OverlayPanel()
    private let view = StripView()
    private let label = HoverLabel()
    private var layout = StripLayout.fitting(count: 0, height: 0)
    /// The sessions the current layout has room for.
    private var shown: [PanelSession] = []
    private var hovered: Cell?
    private var clock: Timer?
    private static let framesPerSecond = 4.0
    private static let edgeKey = "edge"

    var hidden = false {
        didSet { relayout() }
    }

    var edge: ScreenEdge {
        didSet {
            Preferences.store.set(edge.rawValue, forKey: Self.edgeKey)
            relayout()
        }
    }

    init(link: AgentLink) {
        self.link = link
        edge = Preferences.store.string(forKey: Self.edgeKey).flatMap(ScreenEdge.init(rawValue:)) ?? .right
        view.onHover = { [weak self] index in self?.hover(index) }
        view.onClick = { [weak self] index in self?.click(index) }
        view.menuFor = { [weak self] index in self?.menu(for: index) }
        panel.contentView = view

        track { [weak self] in self?.relayout() }
        NotificationCenter.default.addObserver(
            forName: NSApplication.didChangeScreenParametersNotification, object: nil, queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated { self?.relayout() }
        }
    }

    private func relayout() {
        shown = link.list.shown(at: Date())
        // The screen with the menu bar.
        guard !hidden, let screen = NSScreen.screens.first else {
            panel.orderOut(nil)
            label.hide()
            stopClock()
            hovered = nil // no mouseExited arrives for a window taken off screen
            return
        }
        layout = StripLayout.fitting(count: shown.count + 1, height: screen.visibleFrame.height)
        let frame = layout.frame(in: screen.visibleFrame, edge: edge)
        if panel.frame != frame { panel.setFrame(frame, display: false) }
        view.arrange(layout, edge: edge)
        panel.orderFrontRegardless()
        startClock()
        render()
    }

    private func render() {
        let now = Date()
        let current = link.list.shown(at: now)
        // A finished session that dozes off leaves the strip, which then needs a new layout.
        guard current.map(\.id) == shown.map(\.id) else { return relayout() }
        shown = current

        let frame = Int(now.timeIntervalSinceReferenceDate * Self.framesPerSecond)
        let focusedId = link.list.focusedId
        view.show(shown.map {
            CreatureAppearance(session: $0, focused: $0.id == focusedId, hovered: hovered == .session($0.id), frame: frame, now: now)
        } + [CreatureAppearance.addButton(hovered: hovered == .add)])

        let notice = link.notice
        let noticeCell = notice.map { $0.sessionId.map(Cell.session) ?? .add }
        guard let labelled = hovered ?? noticeCell, let index = index(of: labelled) else { return label.hide() }
        let failure = noticeCell == labelled ? notice?.message : nil
        let name: String
        let status: String
        let color: NSColor
        if index < shown.count {
            let session = shown[index]
            name = session.name
            status = failure ?? session.statusLine(at: now)
            color = failure != nil ? NSColor(paint: .danger) : session.needsAttention ? NSColor(paint: .accent) : Style.muted
        } else {
            name = "Add a session"
            status = failure ?? "pin any session from the Claude app"
            color = failure != nil ? NSColor(paint: .danger) : Style.muted
        }
        label.show(HoverLabel.Content(
            name: name,
            status: status,
            statusColor: color,
            frameBeside: layout.cellFrame(index, in: panel.frame),
            strip: panel.frame,
            edge: edge
        ))
    }

    private func cell(at index: Int) -> Cell? {
        if shown.indices.contains(index) { return .session(shown[index].id) }
        return index == shown.count ? .add : nil
    }

    private func index(of cell: Cell) -> Int? {
        switch cell {
        case .session(let id): return shown.firstIndex { $0.id == id }
        case .add: return shown.count
        }
    }

    private func startClock() {
        guard clock == nil else { return }
        let period = 1 / Self.framesPerSecond
        // Ticks land just after each frame boundary, so no frame is skipped or drawn twice.
        let firstTick = ((Date().timeIntervalSinceReferenceDate / period).rounded(.down) + 1) * period + 0.005
        let timer = Timer(fire: Date(timeIntervalSinceReferenceDate: firstTick), interval: period, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { self?.render() }
        }
        timer.tolerance = 0.02
        RunLoop.main.add(timer, forMode: .common)
        clock = timer
    }

    private func stopClock() {
        clock?.invalidate()
        clock = nil
    }

    private func hover(_ index: Int?) {
        let cell = index.flatMap(cell(at:))
        guard cell != hovered else { return }
        hovered = cell
        render()
    }

    private func menu(for index: Int) -> NSMenu? {
        guard case .session(let id)? = cell(at: index), let session = shown.first(where: { $0.id == id }) else { return nil }
        hover(nil) // the label would sit under the menu
        return CreatureMenu.make(for: session) { [link] message in link.send(message) }
    }

    private func click(_ index: Int) {
        switch cell(at: index) {
        case .session(let id)?:
            link.send(.open(id: id))
        case .add?:
            hover(nil)
            link.requestLibrary { [weak self] entries in
                // Not from inside the agent's receive loop: the menu runs its own event loop until it closes.
                DispatchQueue.main.async {
                    MainActor.assumeIsolated { self?.showLibrary(entries) }
                }
            }
        case nil:
            break
        }
    }

    private func showLibrary(_ entries: [LibraryEntry]) {
        let menu = LibraryMenu.make(entries, now: Date()) { [link] message in link.send(message) }
        view.popUp(menu, atCell: shown.count)
    }
}

final class OverlayPanel: NSPanel {
    init() {
        super.init(contentRect: .zero, styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: true)
        isOpaque = false
        backgroundColor = .clear
        hasShadow = false
        level = .statusBar
        collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary, .ignoresCycle]
        isFloatingPanel = true
        hidesOnDeactivate = false
        becomesKeyOnlyIfNeeded = true
        isMovable = false
        animationBehavior = .none
    }

    override var canBecomeKey: Bool { false }
    override var canBecomeMain: Bool { false }
}

/// Calls `apply` now, then again after each change to the observable state it read.
@MainActor
func track(_ apply: @escaping @MainActor () -> Void) {
    withObservationTracking(apply) {
        Task { @MainActor in track(apply) }
    }
}

enum Preferences {
    static let store = UserDefaults(suiteName: "com.elrincondeldev.perch") ?? .standard
}
