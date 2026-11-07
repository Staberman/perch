import AppKit
import Observation
import PerchCore
import SwiftUI

@MainActor @Observable
final class StripState {
    var layout = StripLayout.fitting(count: 0, height: 0)
    var edge = ScreenEdge.right
    var hoveredId: String?
    /// StripView runs its animation clock only while this is true.
    var onScreen = false
}

@MainActor
final class StripController {
    private let link: AgentLink
    private let state = StripState()
    private let strip = OverlayPanel()
    private let label = OverlayPanel()
    private static let labelSize = CGSize(width: 320, height: 56)
    private static let edgeKey = "edge"

    var hidden = false {
        didSet { relayout() }
    }

    var edge: ScreenEdge {
        get { state.edge }
        set {
            state.edge = newValue
            Preferences.store.set(newValue.rawValue, forKey: Self.edgeKey)
            relayout()
        }
    }

    init(link: AgentLink) {
        self.link = link
        state.edge = Preferences.store.string(forKey: Self.edgeKey).flatMap(ScreenEdge.init(rawValue:)) ?? .right

        let input = StripInputView(
            content: NSHostingView(rootView: StripView(link: link, state: state)),
            layout: { [state] in state.layout },
            onHover: { [weak self] index in self?.hover(index) },
            onClick: { [weak self] index in self?.click(index) }
        )
        strip.contentView = input

        label.ignoresMouseEvents = true
        label.contentView = NSHostingView(rootView: HoverLabelView(link: link, state: state))
        label.setContentSize(Self.labelSize)

        track { [weak self] in self?.relayout() }
        NotificationCenter.default.addObserver(
            forName: NSApplication.didChangeScreenParametersNotification, object: nil, queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated { self?.relayout() }
        }
    }

    private func relayout() {
        let shown = link.list.shown
        let notice = link.notice
        // The screen with the menu bar.
        guard !hidden, !shown.isEmpty, let screen = NSScreen.screens.first else {
            strip.orderOut(nil)
            label.orderOut(nil)
            if state.onScreen { state.onScreen = false }
            if state.hoveredId != nil { state.hoveredId = nil } // no mouseExited arrives for a window taken off screen
            return
        }
        let layout = StripLayout.fitting(count: shown.count, height: screen.visibleFrame.height)
        let frame = layout.frame(in: screen.visibleFrame, edge: state.edge)
        if state.layout != layout { state.layout = layout }
        if strip.frame != frame { strip.setFrame(frame, display: true) }
        strip.orderFrontRegardless()
        if !state.onScreen { state.onScreen = true }

        let labelled = state.hoveredId ?? notice?.sessionId
        guard let index = shown.firstIndex(where: { $0.id == labelled }) else { return label.orderOut(nil) }
        let cell = layout.cellFrame(index, in: frame)
        label.setFrame(StripLayout.labelFrame(size: Self.labelSize, beside: cell, strip: frame, edge: state.edge), display: true)
        label.orderFrontRegardless()
    }

    private func hover(_ index: Int?) {
        let shown = link.list.shown
        let id = index.flatMap { shown.indices.contains($0) ? shown[$0].id : nil }
        if state.hoveredId != id { state.hoveredId = id }
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

/// Handles the mouse itself with an always-active tracking area, because Perch is never the active app.
final class StripInputView: NSView {
    private let layout: () -> StripLayout
    private let onHover: (Int?) -> Void
    private let onClick: (Int) -> Void
    private var pressed: Int?

    init(content: NSView, layout: @escaping () -> StripLayout, onHover: @escaping (Int?) -> Void, onClick: @escaping (Int) -> Void) {
        self.layout = layout
        self.onHover = onHover
        self.onClick = onClick
        super.init(frame: .zero)
        content.autoresizingMask = [.width, .height]
        addSubview(content)
        addTrackingArea(NSTrackingArea(
            rect: .zero,
            options: [.mouseMoved, .mouseEnteredAndExited, .activeAlways, .inVisibleRect],
            owner: self
        ))
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("not used") }

    override func hitTest(_ point: NSPoint) -> NSView? {
        bounds.contains(convert(point, from: superview)) ? self : nil
    }

    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }

    override func mouseEntered(with event: NSEvent) { onHover(index(of: event)) }
    override func mouseMoved(with event: NSEvent) { onHover(index(of: event)) }
    override func mouseExited(with event: NSEvent) { onHover(nil) }

    override func mouseDown(with event: NSEvent) {
        pressed = index(of: event)
    }

    override func mouseUp(with event: NSEvent) {
        defer { pressed = nil }
        if let index = index(of: event), index == pressed { onClick(index) }
    }

    private func index(of event: NSEvent) -> Int? {
        let point = convert(event.locationInWindow, from: nil)
        return layout().index(atY: bounds.height - point.y)
    }
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
