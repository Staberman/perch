import CoreGraphics

public enum ScreenEdge: String, CaseIterable, Sendable {
    case left, right
}

/// Points, with AppKit's bottom-left origin unless noted.
public struct StripLayout: Equatable, Sendable {
    public static let inset: CGFloat = 4
    public static let labelGap: CGFloat = 6
    private static let cellPaddingPixels = 2
    private static let cellPixels = CGFloat(spriteSize + 2 * cellPaddingPixels)
    /// Halves keep every sprite pixel on whole Retina pixels.
    private static let scales: [CGFloat] = [2, 1.5, 1]

    public let count: Int
    /// Points per sprite pixel.
    public let scale: CGFloat

    public var cellSide: CGFloat { scale * Self.cellPixels }

    public var size: CGSize {
        CGSize(width: cellSide + 2 * Self.inset, height: CGFloat(count) * cellSide + 2 * Self.inset)
    }

    /// Past the smallest scale the strip overflows, and `frame(in:edge:)` cuts it to the screen.
    public static func fitting(count: Int, height: CGFloat) -> StripLayout {
        let scale = scales.first { CGFloat(count) * $0 * cellPixels + 2 * inset <= height } ?? scales.last!
        return StripLayout(count: count, scale: scale)
    }

    public func frame(in visible: CGRect, edge: ScreenEdge) -> CGRect {
        let height = min(size.height, visible.height)
        let x = edge == .right ? visible.maxX - size.width : visible.minX
        return CGRect(x: x, y: visible.midY - height / 2, width: size.width, height: height)
    }

    public func tileRect(in cell: CGRect) -> CGRect {
        cell.insetBy(dx: scale, dy: scale)
    }

    public func spriteRect(in cell: CGRect) -> CGRect {
        let inset = CGFloat(Self.cellPaddingPixels) * scale
        return cell.insetBy(dx: inset, dy: inset)
    }

    /// `y` is measured down from the strip's top edge.
    public func index(atY y: CGFloat) -> Int? {
        guard y >= Self.inset else { return nil }
        let index = Int((y - Self.inset) / cellSide)
        return index < count ? index : nil
    }

    public func cellFrame(_ index: Int, in strip: CGRect) -> CGRect {
        CGRect(
            x: strip.minX + Self.inset,
            y: strip.maxY - Self.inset - CGFloat(index + 1) * cellSide,
            width: cellSide,
            height: cellSide
        )
    }

    public static func labelFrame(size: CGSize, beside cell: CGRect, strip: CGRect, edge: ScreenEdge) -> CGRect {
        let x = edge == .right ? strip.minX - labelGap - size.width : strip.maxX + labelGap
        return CGRect(x: x, y: cell.midY - size.height / 2, width: size.width, height: size.height)
    }
}
