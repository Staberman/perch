import PerchCore
import SwiftUI

enum Theme {
    static let accent = Color(rgb: RGB(hex: "#ff6b1a")!)
    static let danger = Color(rgb: RGB(hex: "#ff4d4d")!)
    static let backdrop = Color(white: 0.05, opacity: 0.78)
    static let line = Color(white: 1, opacity: 0.1)
    static let text = Color(white: 0.96)
    static let muted = Color(white: 0.6)
}

private let framesPerSecond = 4.0

struct StripView: View {
    let link: AgentLink
    let state: StripState

    var body: some View {
        if state.onScreen {
            TimelineView(.periodic(from: .now, by: 1 / framesPerSecond)) { context in
                // Counted from a fixed epoch so every creature moves in step.
                let frame = Int(context.date.timeIntervalSinceReferenceDate * framesPerSecond)
                VStack(spacing: 0) {
                    ForEach(link.list.shown) { session in
                        CreatureCell(
                            session: session,
                            frame: frame,
                            now: context.date,
                            focused: session.id == link.list.focusedId,
                            hovered: session.id == state.hoveredId,
                            scale: state.layout.scale
                        )
                        .equatable()
                        .frame(width: state.layout.cellSide, height: state.layout.cellSide)
                    }
                }
                .padding(StripLayout.inset)
                .frame(maxHeight: .infinity, alignment: .top)
                .background(backdrop)
            }
        }
    }

    @MainActor private var backdrop: some View {
        let r: CGFloat = 10
        let shape = state.edge == .right
            ? UnevenRoundedRectangle(topLeadingRadius: r, bottomLeadingRadius: r, bottomTrailingRadius: 0, topTrailingRadius: 0)
            : UnevenRoundedRectangle(topLeadingRadius: 0, bottomLeadingRadius: 0, bottomTrailingRadius: r, topTrailingRadius: r)
        return shape.fill(Theme.backdrop).overlay(shape.stroke(Theme.line, lineWidth: 1))
    }
}

/// Equatable, so clock ticks redraw only the cells that change.
struct CreatureCell: View, Equatable {
    let pixels: Pixels
    let look: Look
    let live: Bool
    let scale: CGFloat

    init(session: PanelSession, frame: Int, now: Date, focused: Bool, hovered: Bool, scale: CGFloat) {
        pixels = spriteFrame(character: session.icon.character, color: session.icon.tint, mood: session.mood(at: now), frame: frame)
        look = Look(session: session, focused: focused, hovered: hovered, frame: frame)
        live = session.live
        self.scale = scale
    }

    var body: some View {
        let tile = RoundedRectangle(cornerRadius: 3 * scale)
        ZStack {
            tile.fill(look.fill)
            tile.strokeBorder(look.border, lineWidth: look.borderWidth)
            SpriteView(pixels: pixels, scale: scale)
                .modifier(Outline(on: look.outlined))
                .grayscale(live ? 0 : 1)
                .opacity(live ? 1 : 0.45)
        }
        .padding(scale)
    }

    /// Attention outranks focus.
    struct Look: Equatable {
        var fill = Color.clear
        var border = Color.clear
        var borderWidth: CGFloat = 1.5
        /// Set when the fill may share the sprite's color.
        var outlined = false

        init(session: PanelSession, focused: Bool, hovered: Bool, frame: Int) {
            if hovered { fill = Color(white: 1, opacity: 0.12) }
            if focused {
                fill = Color(white: 1, opacity: hovered ? 0.3 : 0.22)
                border = Color(white: 1, opacity: 0.75)
            }
            switch session.state {
            case .needsPermission:
                let lit = frame % 4 < 2
                fill = lit ? Theme.accent : Theme.accent.opacity(0.25)
                border = Theme.accent
                borderWidth = 2
                outlined = true
            case .needsInput:
                fill = Theme.accent.opacity(frame % 8 < 4 ? 0.35 : 0.2)
                border = Theme.accent
                borderWidth = 2
                outlined = true
            case .error:
                border = Theme.danger
            default:
                break
            }
        }
    }
}

private struct Outline: ViewModifier {
    let on: Bool

    func body(content: Content) -> some View {
        if on {
            content
                .shadow(color: .black, radius: 0, x: 1, y: 0)
                .shadow(color: .black, radius: 0, x: -1, y: 0)
                .shadow(color: .black, radius: 0, x: 0, y: 1)
                .shadow(color: .black, radius: 0, x: 0, y: -1)
        } else {
            content
        }
    }
}

struct SpriteView: View {
    let pixels: Pixels
    let scale: CGFloat

    var body: some View {
        Canvas { context, _ in
            var paths: [RGB: Path] = [:]
            for (y, row) in pixels.enumerated() {
                for (x, color) in row.enumerated() {
                    guard let color else { continue }
                    paths[color, default: Path()].addRect(CGRect(x: CGFloat(x) * scale, y: CGFloat(y) * scale, width: scale, height: scale))
                }
            }
            for (color, path) in paths { context.fill(path, with: .color(Color(rgb: color))) }
        }
        .frame(width: CGFloat(spriteSize) * scale, height: CGFloat(spriteSize) * scale)
    }
}

struct HoverLabelView: View {
    let link: AgentLink
    let state: StripState

    var body: some View {
        let id = state.hoveredId ?? link.notice?.sessionId
        let alignment: HorizontalAlignment = state.edge == .right ? .trailing : .leading
        if let session = link.list.shown.first(where: { $0.id == id }) {
            let notice = link.notice?.sessionId == session.id ? link.notice?.message : nil
            VStack(alignment: alignment, spacing: 2) {
                Text(session.name)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.text)
                Text(notice ?? session.statusLine(at: .now))
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundStyle(notice != nil ? Theme.danger : session.needsAttention ? Theme.accent : Theme.muted)
            }
            .lineLimit(1)
            .truncationMode(.tail)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(RoundedRectangle(cornerRadius: 8).fill(Theme.backdrop).overlay(RoundedRectangle(cornerRadius: 8).stroke(Theme.line)))
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: Alignment(horizontal: alignment, vertical: .center))
        }
    }
}

extension Color {
    init(rgb: RGB) {
        self.init(.sRGB, red: Double(rgb.r) / 255, green: Double(rgb.g) / 255, blue: Double(rgb.b) / 255)
    }
}
