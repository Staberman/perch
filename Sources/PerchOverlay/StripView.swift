import AppKit
import PerchCore

/// Changes only the layers whose appearance differs from the last frame, so an unchanged strip costs
/// Core Animation nothing.
final class StripView: NSView {
    var onHover: (Int?) -> Void = { _ in }
    var onClick: (Int) -> Void = { _ in }
    var menuFor: (Int) -> NSMenu? = { _ in nil }

    private var layout = StripLayout.fitting(count: 0, height: 0)
    private let backdrop = CALayer()
    private var creatures: [CreatureLayers] = []
    private var pressed: Int?

    init() {
        super.init(frame: .zero)
        layer = CALayer()
        wantsLayer = true
        backdrop.backgroundColor = Style.backdrop
        backdrop.borderColor = Style.line
        backdrop.borderWidth = 1
        backdrop.cornerRadius = 10
        layer!.addSublayer(backdrop)
        // Always active, because Perch is never the active app.
        addTrackingArea(NSTrackingArea(
            rect: .zero,
            options: [.mouseMoved, .mouseEnteredAndExited, .activeAlways, .inVisibleRect],
            owner: self
        ))
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("not used") }

    func arrange(_ layout: StripLayout, edge: ScreenEdge) {
        withoutAnimation {
            self.layout = layout
            backdrop.frame = bounds
            backdrop.maskedCorners = edge == .right
                ? [.layerMinXMinYCorner, .layerMinXMaxYCorner]
                : [.layerMaxXMinYCorner, .layerMaxXMaxYCorner]
            while creatures.count < layout.count {
                let creature = CreatureLayers()
                layer!.addSublayer(creature.root)
                creatures.append(creature)
            }
            while creatures.count > layout.count {
                creatures.removeLast().root.removeFromSuperlayer()
            }
            for (index, creature) in creatures.enumerated() {
                creature.place(in: layout.cellFrame(index, in: bounds), layout: layout)
            }
        }
    }

    /// Opens `menu` beside cell `index`, outside any mouse event.
    func popUp(_ menu: NSMenu, atCell index: Int) {
        let cell = layout.cellFrame(index, in: bounds)
        menu.popUp(positioning: nil, at: NSPoint(x: cell.minX, y: cell.maxY), in: self)
    }

    func show(_ appearances: [CreatureAppearance]) {
        withoutAnimation {
            for (creature, appearance) in zip(creatures, appearances) { creature.show(appearance) }
        }
    }

    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }

    override func mouseEntered(with event: NSEvent) { onHover(index(of: event)) }
    override func mouseMoved(with event: NSEvent) { onHover(index(of: event)) }
    override func mouseExited(with event: NSEvent) { onHover(nil) }

    override func mouseDown(with event: NSEvent) {
        if event.modifierFlags.contains(.control) { return showMenu(for: event) }
        pressed = index(of: event)
    }

    override func rightMouseDown(with event: NSEvent) {
        showMenu(for: event)
    }

    private func showMenu(for event: NSEvent) {
        guard let index = index(of: event), let menu = menuFor(index) else { return }
        NSMenu.popUpContextMenu(menu, with: event, for: self)
    }

    override func mouseUp(with event: NSEvent) {
        defer { pressed = nil }
        if let index = index(of: event), index == pressed { onClick(index) }
    }

    private func index(of event: NSEvent) -> Int? {
        let point = convert(event.locationInWindow, from: nil)
        return layout.index(atY: bounds.height - point.y)
    }
}

private final class CreatureLayers {
    let root = CALayer()
    private let tile = CALayer()
    private let sprite = CALayer()
    private var shown: CreatureAppearance?

    init() {
        sprite.magnificationFilter = .nearest
        root.addSublayer(tile)
        root.addSublayer(sprite)
    }

    func place(in cell: CGRect, layout: StripLayout) {
        root.frame = cell
        tile.frame = layout.tileRect(in: root.bounds)
        tile.cornerRadius = 3 * layout.scale
        sprite.frame = layout.spriteRect(in: root.bounds)
    }

    func show(_ appearance: CreatureAppearance) {
        guard appearance != shown else { return }
        if appearance.pixels != shown?.pixels { sprite.contents = SpriteImages.image(for: appearance.pixels) }
        if appearance.tile != shown?.tile {
            tile.backgroundColor = appearance.tile.fill.map(CGColor.paint)
            tile.borderColor = appearance.tile.border.map(CGColor.paint)
            tile.borderWidth = appearance.tile.border == nil ? 0 : appearance.tile.borderWidth
        }
        if appearance.opacity != shown?.opacity { sprite.opacity = Float(appearance.opacity) }
        shown = appearance
    }
}

enum Style {
    static let backdrop = CGColor(gray: 0.05, alpha: 0.78)
    static let line = CGColor(gray: 1, alpha: 0.1)
    static let text = NSColor(white: 0.96, alpha: 1)
    static let muted = NSColor(white: 0.6, alpha: 1)
}

extension CGColor {
    static func paint(_ paint: Paint) -> CGColor {
        CGColor(srgbRed: CGFloat(paint.rgb.r) / 255, green: CGFloat(paint.rgb.g) / 255, blue: CGFloat(paint.rgb.b) / 255, alpha: paint.alpha)
    }
}

extension NSColor {
    convenience init(paint: Paint) {
        self.init(cgColor: CGColor.paint(paint))!
    }
}

/// Animations cycle through a few frames; reusing their images lets Core Animation keep its
/// converted copies instead of converting a new image on every frame.
private enum SpriteImages {
    private static var cache: [Pixels: CGImage] = [:]
    private static let limit = 512

    static func image(for pixels: Pixels) -> CGImage? {
        if let image = cache[pixels] { return image }
        if cache.count >= limit { cache.removeAll() }
        let image = CGImage.sprite(pixels)
        cache[pixels] = image
        return image
    }
}

extension CGImage {
    static func sprite(_ pixels: Pixels) -> CGImage? {
        let height = pixels.count
        let width = pixels.first?.count ?? 0
        var bytes = [UInt8](repeating: 0, count: width * height * 4)
        for (y, row) in pixels.enumerated() {
            for (x, color) in row.enumerated() {
                guard let color else { continue }
                let i = (y * width + x) * 4
                bytes[i] = color.r
                bytes[i + 1] = color.g
                bytes[i + 2] = color.b
                bytes[i + 3] = 255
            }
        }
        guard let provider = CGDataProvider(data: Data(bytes) as CFData) else { return nil }
        return CGImage(
            width: width, height: height, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: width * 4,
            space: CGColorSpace(name: CGColorSpace.sRGB)!,
            bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue),
            provider: provider, decode: nil, shouldInterpolate: false, intent: .defaultIntent
        )
    }
}

private func withoutAnimation(_ changes: () -> Void) {
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    changes()
    CATransaction.commit()
}
