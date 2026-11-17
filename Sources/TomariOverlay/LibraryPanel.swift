import AppKit
import TomariCore

/// The + panel: one tab per agent, a search field, and the matching sessions; choosing one pins it, or unpins it
/// when it already is. A floating panel rather than a menu, so the search field takes typing like any other.
/// It takes the keyboard without activating Tomari, so the app you were in stays in front, and closes when it
/// loses the keyboard: a click elsewhere, Esc, or a choice.
@MainActor
final class LibraryPanel: NSObject, NSTableViewDataSource, NSTableViewDelegate, NSSearchFieldDelegate, NSWindowDelegate {
    /// The panel on screen, kept alive while it shows.
    private static var current: LibraryPanel?

    private static let size = NSSize(width: 320, height: 420)
    private static let gap: CGFloat = 8
    private static let tabKey = "libraryTab"

    private let window: KeyPanel
    private let tabs = NSSegmentedControl()
    private let field = NSSearchField()
    private let table = HoverTable()
    private let empty = NSTextField(labelWithString: "No sessions")
    private var browser: LibraryBrowser
    private let now: Date
    private let send: (ClientMessage) -> Void

    /// Shows the panel beside `anchor` (the + cell, in screen coordinates), on the side of the strip away from `edge`.
    static func show(_ entries: [LibraryEntry], now: Date, beside anchor: NSRect, edge: ScreenEdge, send: @escaping (ClientMessage) -> Void) {
        current?.close()
        let preferred = Preferences.store.string(forKey: tabKey)
        let panel = LibraryPanel(browser: LibraryBrowser(entries: entries, preferredAgent: preferred), now: now, send: send)
        current = panel
        panel.present(beside: anchor, edge: edge)
    }

    private init(browser: LibraryBrowser, now: Date, send: @escaping (ClientMessage) -> Void) {
        self.browser = browser
        self.now = now
        self.send = send
        window = KeyPanel(contentRect: NSRect(origin: .zero, size: Self.size), styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: true)
        super.init()
        build()
    }

    // MARK: Layout

    private func build() {
        window.isOpaque = false
        window.backgroundColor = .clear
        window.hasShadow = true
        window.level = .popUpMenu
        window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .transient, .ignoresCycle]
        window.isFloatingPanel = true
        window.hidesOnDeactivate = false
        window.animationBehavior = .utilityWindow
        window.delegate = self
        window.onCancel = { [weak self] in self?.close() }

        let backdrop = NSVisualEffectView(frame: NSRect(origin: .zero, size: Self.size))
        backdrop.material = .popover
        backdrop.state = .active
        backdrop.wantsLayer = true
        backdrop.layer?.cornerRadius = 10
        backdrop.layer?.masksToBounds = true
        window.contentView = backdrop

        tabs.segmentStyle = .automatic
        tabs.trackingMode = .selectOne
        tabs.segmentCount = max(browser.groups.count, 1)
        for (index, group) in browser.groups.enumerated() {
            tabs.setImage(Self.badgeImage(group.badge), forSegment: index)
            tabs.setImageScaling(.scaleNone, forSegment: index)
        }
        tabs.target = self
        tabs.action = #selector(tabChanged)
        tabs.isHidden = browser.groups.isEmpty

        field.placeholderString = "Search by name or folder"
        field.delegate = self
        field.sendsSearchStringImmediately = true
        field.focusRingType = .none

        let column = NSTableColumn(identifier: .init("session"))
        table.addTableColumn(column)
        table.headerView = nil
        table.rowHeight = 36
        table.style = .plain
        table.backgroundColor = .clear
        table.intercellSpacing = NSSize(width: 0, height: 2)
        table.dataSource = self
        table.delegate = self
        table.target = self
        table.action = #selector(rowClicked)
        table.refusesFirstResponder = true
        // Like a menu: the row under the pointer is the one Return and a click act on.
        table.onHover = { [weak self] row in self?.hover(row) }

        let scroll = NSScrollView()
        scroll.documentView = table
        scroll.hasVerticalScroller = true
        scroll.drawsBackground = false
        scroll.autohidesScrollers = true

        empty.textColor = .secondaryLabelColor
        empty.alignment = .center
        empty.isHidden = true

        let terminal = NSButton(title: "New Terminal tab", target: self, action: #selector(newTerminal))
        terminal.bezelStyle = .rounded
        terminal.controlSize = .small

        for view in [tabs, field, scroll, empty, terminal] as [NSView] {
            view.translatesAutoresizingMaskIntoConstraints = false
            backdrop.addSubview(view)
        }
        let pad: CGFloat = 10
        NSLayoutConstraint.activate([
            tabs.topAnchor.constraint(equalTo: backdrop.topAnchor, constant: pad),
            tabs.centerXAnchor.constraint(equalTo: backdrop.centerXAnchor),
            field.topAnchor.constraint(equalTo: browser.groups.isEmpty ? backdrop.topAnchor : tabs.bottomAnchor, constant: pad),
            field.leadingAnchor.constraint(equalTo: backdrop.leadingAnchor, constant: pad),
            field.trailingAnchor.constraint(equalTo: backdrop.trailingAnchor, constant: -pad),
            scroll.topAnchor.constraint(equalTo: field.bottomAnchor, constant: 6),
            scroll.leadingAnchor.constraint(equalTo: backdrop.leadingAnchor, constant: 4),
            scroll.trailingAnchor.constraint(equalTo: backdrop.trailingAnchor, constant: -4),
            scroll.bottomAnchor.constraint(equalTo: terminal.topAnchor, constant: -6),
            empty.centerXAnchor.constraint(equalTo: scroll.centerXAnchor),
            empty.centerYAnchor.constraint(equalTo: scroll.centerYAnchor),
            terminal.leadingAnchor.constraint(equalTo: backdrop.leadingAnchor, constant: pad),
            terminal.bottomAnchor.constraint(equalTo: backdrop.bottomAnchor, constant: -pad),
        ])
        column.width = Self.size.width - 8
        refresh()
    }

    private func present(beside anchor: NSRect, edge: ScreenEdge) {
        let screen = NSScreen.screens.first { $0.frame.intersects(anchor) } ?? NSScreen.main
        let visible = screen?.visibleFrame ?? anchor.insetBy(dx: -1000, dy: -1000)
        let x = edge == .right ? anchor.minX - Self.gap - Self.size.width : anchor.maxX + Self.gap
        // Bottom aligned with the + where it fits, else kept on screen.
        var y = anchor.minY
        y = min(max(y, visible.minY + Self.gap), visible.maxY - Self.size.height - Self.gap)
        window.setFrame(NSRect(x: x, y: y, width: Self.size.width, height: Self.size.height), display: true)
        window.makeKeyAndOrderFront(nil)
        window.makeFirstResponder(field)
    }

    private func close() {
        window.delegate = nil
        window.orderOut(nil)
        if Self.current === self { Self.current = nil }
    }

    // MARK: State → view

    private func refresh() {
        for index in browser.groups.indices {
            tabs.setLabel("\(browser.groups[index].title) \(browser.count(inTab: index))", forSegment: index)
            tabs.setWidth(0, forSegment: index)
        }
        if !browser.groups.isEmpty { tabs.selectedSegment = browser.tab }
        table.reloadData()
        empty.stringValue = browser.groups.isEmpty ? "No sessions" : "No matches"
        empty.isHidden = !browser.visible.isEmpty
        showSelection()
    }

    private func hover(_ row: Int) {
        guard row != browser.selection else { return }
        browser.select(row: row)
        if let row = browser.selection { table.selectRowIndexes([row], byExtendingSelection: false) }
    }

    private func showSelection() {
        if let row = browser.selection {
            table.selectRowIndexes([row], byExtendingSelection: false)
            table.scrollRowToVisible(row)
        } else {
            table.deselectAll(nil)
        }
    }

    // MARK: Actions

    @objc private func tabChanged() {
        browser.select(tab: tabs.selectedSegment)
        rememberTab()
        refresh()
        window.makeFirstResponder(field)
    }

    @objc private func rowClicked() {
        guard table.clickedRow >= 0 else { return }
        browser.select(row: table.clickedRow)
        choose()
    }

    @objc private func newTerminal() {
        close()
        send(.terminal)
    }

    /// Pins the selected session, or unpins it, and closes.
    private func choose() {
        guard let entry = browser.selected else { return }
        close()
        send(.pin(id: entry.id, pinned: !entry.pinned))
    }

    private func rememberTab() {
        if let agent = browser.agent { Preferences.store.set(agent, forKey: Self.tabKey) }
    }

    func controlTextDidChange(_ obj: Notification) {
        browser.search(field.stringValue)
        refresh()
    }

    func control(_ control: NSControl, textView: NSTextView, doCommandBy selector: Selector) -> Bool {
        switch selector {
        case #selector(NSResponder.moveDown(_:)): browser.move(by: 1)
        case #selector(NSResponder.moveUp(_:)): browser.move(by: -1)
        case #selector(NSResponder.insertTab(_:)), #selector(NSResponder.insertBacktab(_:)):
            browser.nextTab()
            rememberTab()
            refresh()
            return true
        case #selector(NSResponder.insertNewline(_:)):
            choose()
            return true
        case #selector(NSResponder.cancelOperation(_:)):
            if field.stringValue.isEmpty { close() } else { field.stringValue = ""; browser.search(""); refresh() }
            return true
        default:
            return false
        }
        showSelection()
        return true
    }

    func windowDidResignKey(_ notification: Notification) {
        close()
    }

    // MARK: Table

    func numberOfRows(in tableView: NSTableView) -> Int {
        browser.visible.count
    }

    func tableView(_ tableView: NSTableView, viewFor tableColumn: NSTableColumn?, row: Int) -> NSView? {
        let entry = browser.visible[row]
        let cell = (tableView.makeView(withIdentifier: SessionRow.identifier, owner: nil) as? SessionRow) ?? SessionRow()
        cell.show(entry, now: now)
        return cell
    }

    func tableView(_ tableView: NSTableView, rowViewForRow row: Int) -> NSTableRowView? {
        HighlightRow()
    }

    func tableViewSelectionDidChange(_ notification: Notification) {
        if table.selectedRow >= 0 { browser.select(row: table.selectedRow) }
    }

    // MARK: Images

    private static let badgePointsPerPixel: CGFloat = 2

    /// The agent's badge on a small dark tile, as on the strip, so a light badge shows in a light panel too.
    static func badgeImage(_ badge: AgentBadge) -> NSImage {
        let pixels = badge.pixels
        let image = CGImage.sprite(pixels)
        let size = CGSize(width: CGFloat(pixels.first?.count ?? 0) * badgePointsPerPixel, height: CGFloat(pixels.count) * badgePointsPerPixel)
        return NSImage(size: NSSize(width: 16, height: 16), flipped: false) { rect in
            guard let image, let context = NSGraphicsContext.current else { return false }
            NSColor(white: 0.16, alpha: 1).setFill()
            NSBezierPath(roundedRect: rect, xRadius: 3, yRadius: 3).fill()
            context.imageInterpolation = .none
            context.cgContext.draw(image, in: CGRect(x: rect.midX - size.width / 2, y: rect.midY - size.height / 2, width: size.width, height: size.height))
            return true
        }
    }
}

/// A borderless panel that takes the keyboard without activating the app.
private final class KeyPanel: NSPanel {
    var onCancel: (() -> Void)?

    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { false }

    override func cancelOperation(_ sender: Any?) {
        onCancel?()
    }
}

/// A table that reports the row under the pointer as it moves.
private final class HoverTable: NSTableView {
    var onHover: ((Int) -> Void)?
    private var tracking: NSTrackingArea?

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        if let tracking { removeTrackingArea(tracking) }
        let area = NSTrackingArea(rect: .zero, options: [.mouseMoved, .mouseEnteredAndExited, .activeAlways, .inVisibleRect], owner: self)
        addTrackingArea(area)
        tracking = area
    }

    override func mouseMoved(with event: NSEvent) {
        let row = row(at: convert(event.locationInWindow, from: nil))
        if row >= 0 { onHover?(row) }
    }

    override func mouseEntered(with event: NSEvent) {
        mouseMoved(with: event)
    }
}

/// The selected row in the accent color even while the search field has the keyboard, as a menu highlights.
private final class HighlightRow: NSTableRowView {
    override var isEmphasized: Bool {
        get { true }
        set {}
    }

    override func drawSelection(in dirtyRect: NSRect) {
        guard selectionHighlightStyle != .none else { return }
        NSColor.controlAccentColor.setFill()
        NSBezierPath(roundedRect: bounds.insetBy(dx: 4, dy: 0), xRadius: 6, yRadius: 6).fill()
    }

    override var interiorBackgroundStyle: NSView.BackgroundStyle {
        isSelected ? .emphasized : .normal
    }
}

/// One session: its name, then its folder and how long ago it was active, with a pin when it is pinned.
private final class SessionRow: NSTableCellView {
    static let identifier = NSUserInterfaceItemIdentifier("SessionRow")

    private let name = NSTextField(labelWithString: "")
    private let detail = NSTextField(labelWithString: "")
    private let pin = NSImageView()

    init() {
        super.init(frame: .zero)
        identifier = Self.identifier
        name.font = .systemFont(ofSize: 13)
        detail.font = .systemFont(ofSize: 11)
        detail.textColor = .secondaryLabelColor
        for field in [name, detail] {
            field.lineBreakMode = .byTruncatingTail
            field.maximumNumberOfLines = 1
            field.cell?.truncatesLastVisibleLine = true
        }
        pin.image = NSImage(systemSymbolName: "pin.fill", accessibilityDescription: "Pinned")
        pin.contentTintColor = .secondaryLabelColor
        for view in [name, detail, pin] as [NSView] {
            view.translatesAutoresizingMaskIntoConstraints = false
            addSubview(view)
        }
        name.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        detail.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        NSLayoutConstraint.activate([
            name.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 8),
            name.trailingAnchor.constraint(lessThanOrEqualTo: pin.leadingAnchor, constant: -6),
            name.topAnchor.constraint(equalTo: topAnchor, constant: 2),
            detail.leadingAnchor.constraint(equalTo: name.leadingAnchor),
            detail.trailingAnchor.constraint(lessThanOrEqualTo: pin.leadingAnchor, constant: -6),
            detail.topAnchor.constraint(equalTo: name.bottomAnchor, constant: 1),
            pin.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -8),
            pin.centerYAnchor.constraint(equalTo: centerYAnchor),
            pin.widthAnchor.constraint(equalToConstant: 12),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("not used") }

    /// White on the accent highlight, the usual colors elsewhere.
    override var backgroundStyle: NSView.BackgroundStyle {
        didSet {
            let highlighted = backgroundStyle == .emphasized
            name.textColor = highlighted ? .white : .labelColor
            detail.textColor = highlighted ? NSColor.white.withAlphaComponent(0.8) : .secondaryLabelColor
            pin.contentTintColor = highlighted ? .white : .secondaryLabelColor
        }
    }

    func show(_ entry: LibraryEntry, now: Date) {
        name.stringValue = entry.name
        detail.stringValue = "\(entry.folder) · \(ago(since: entry.lastActivityAt, now: now))"
        pin.isHidden = !entry.pinned
        toolTip = "\(entry.name)\n\(entry.cwd)"
    }
}
