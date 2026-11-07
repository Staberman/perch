import AppKit
import Observation
import PerchCore

@MainActor
final class StripController {
    private let link: AgentLink
    private let panel = OverlayPanel()
    private let view = StripView()
    private let label = HoverLabel()
    private var layout = StripLayout.fitting(count: 0, height: 0)
    private var hoveredId: String?
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
        panel.contentView = view

        track { [weak self] in self?.relayout() }
        NotificationCenter.default.addObserver(
            forName: NSApplication.didChangeScreenParametersNotification, object: nil, queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated { self?.relayout() }
        }
    }

    private func relayout() {
        let shown = link.list.shown
        // The screen with the menu bar.
        guard !hidden, !shown.isEmpty, let screen = NSScreen.screens.first else {
            panel.orderOut(nil)
            label.hide()
            stopClock()
            hoveredId = nil // no mouseExited arrives for a window taken off screen
            return
        }
        layout = StripLayout.fitting(count: shown.count, height: screen.visibleFrame.height)
        let frame = layout.frame(in: screen.visibleFrame, edge: edge)
        if panel.frame != frame { panel.setFrame(frame, display: false) }
        view.arrange(layout, edge: edge)
        panel.orderFrontRegardless()
        startClock()
        render()
    }

    private func render() {
        let now = Date()
        let frame = Int(now.timeIntervalSinceReferenceDate * Self.framesPerSecond)
        let shown = link.list.shown
        let focusedId = link.list.focusedId
        view.show(shown.map {
            CreatureAppearance(session: $0, focused: $0.id == focusedId, hovered: $0.id == hoveredId, frame: frame, now: now)
        })

        let notice = link.notice
        let labelled = hoveredId ?? notice?.sessionId
        guard let index = shown.firstIndex(where: { $0.id == labelled }) else { return label.hide() }
        let session = shown[index]
        let failure = notice?.sessionId == session.id ? notice?.message : nil
        label.show(HoverLabel.Content(
            name: session.name,
            status: failure ?? session.statusLine(at: now),
            statusColor: failure != nil ? NSColor(paint: .danger) : session.needsAttention ? NSColor(paint: .accent) : Style.muted,
            frameBeside: layout.cellFrame(index, in: panel.frame),
            strip: panel.frame,
            edge: edge
        ))
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
        let shown = link.list.shown
        let id = index.flatMap { shown.indices.contains($0) ? shown[$0].id : nil }
        guard id != hoveredId else { return }
        hoveredId = id
        render()
    }

    private func click(_ index: Int) {
        let shown = link.list.shown
        if shown.indices.contains(index) { link.open(shown[index].id) }
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
