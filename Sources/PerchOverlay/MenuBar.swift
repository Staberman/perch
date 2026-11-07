import AppKit
import PerchCore

@MainActor
final class MenuBar: NSObject, NSMenuDelegate {
    private let link: AgentLink
    private let strip: StripController
    private let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)

    init(link: AgentLink, strip: StripController) {
        self.link = link
        self.strip = strip
        super.init()
        item.button?.image = Self.icon()
        item.button?.imagePosition = .imageLeading
        item.button?.toolTip = "Perch"
        let menu = NSMenu()
        menu.delegate = self
        item.menu = menu

        track { [weak self] in
            guard let self else { return }
            let waiting = link.list.shown.filter(\.needsAttention).count
            item.button?.title = waiting > 0 ? " \(waiting)" : ""
        }
    }

    func menuNeedsUpdate(_ menu: NSMenu) {
        menu.removeAllItems()
        menu.addItem(withTitle: statusText, action: nil, keyEquivalent: "")
        menu.addItem(.separator())

        menu.addItem(entry(strip.hidden ? "Show Strip" : "Hide Strip", #selector(toggleStrip)))
        let edges = NSMenu()
        for edge in ScreenEdge.allCases {
            let choice = entry(edge.rawValue.capitalized, #selector(chooseEdge(_:)))
            choice.representedObject = edge.rawValue
            choice.state = strip.edge == edge ? .on : .off
            edges.addItem(choice)
        }
        let edgeItem = NSMenuItem(title: "Edge", action: nil, keyEquivalent: "")
        edgeItem.submenu = edges
        menu.addItem(edgeItem)

        menu.addItem(.separator())
        menu.addItem(withTitle: "Quit Perch", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
    }

    private var statusText: String {
        switch link.status {
        case .online:
            let count = link.list.shown.count
            return "Connected · \(count) session\(count == 1 ? "" : "s")"
        case .connecting: return "Connecting to the agent…"
        case .offline: return "Agent not running · retrying"
        case .notPaired: return "Agent not set up · retrying"
        }
    }

    private func entry(_ title: String, _ action: Selector) -> NSMenuItem {
        let item = NSMenuItem(title: title, action: action, keyEquivalent: "")
        item.target = self
        return item
    }

    @objc private func toggleStrip() {
        strip.hidden.toggle()
    }

    @objc private func chooseEdge(_ sender: NSMenuItem) {
        if let edge = (sender.representedObject as? String).flatMap(ScreenEdge.init(rawValue:)) { strip.edge = edge }
    }

    private static func icon() -> NSImage {
        let character = CharacterTemplate.named("default")
        let eyes = Set([character.eyes.left, character.eyes.right].flatMap { x in
            [(x, character.eyes.y), (x + 1, character.eyes.y), (x, character.eyes.y + 1), (x + 1, character.eyes.y + 1)].map { "\($0.0),\($0.1)" }
        })
        let image = NSImage(size: NSSize(width: 16, height: 16), flipped: true) { _ in
            NSColor.black.setFill()
            for (y, row) in character.body.enumerated() {
                for (x, cell) in row.enumerated() where cell != "." && !eyes.contains("\(x),\(y)") {
                    NSRect(x: x, y: y, width: 1, height: 1).fill()
                }
            }
            return true
        }
        image.isTemplate = true
        return image
    }
}
