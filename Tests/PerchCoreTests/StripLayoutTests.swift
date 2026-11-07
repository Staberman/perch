import CoreGraphics
import PerchCore

private let screen = CGRect(x: 0, y: 0, width: 1440, height: 900)

func stripLayoutTests() {
    test("creatures are as big as the screen allows, in steps that land on whole Retina pixels") {
        expectEqual(StripLayout.fitting(count: 3, height: 900).scale, 2)
        expectEqual(StripLayout.fitting(count: 20, height: 900).scale, 1.5)
        expectEqual(StripLayout.fitting(count: 40, height: 900).scale, 1)
    }

    test("the strip is one cell wide and one cell tall per creature, plus its inset") {
        let layout = StripLayout.fitting(count: 3, height: 900)
        expectEqual(layout.cellSide, 56)
        expectEqual(layout.size, CGSize(width: 56 + 2 * StripLayout.inset, height: 3 * 56 + 2 * StripLayout.inset))
    }

    test("docks to the middle of the chosen edge") {
        let layout = StripLayout.fitting(count: 3, height: screen.height)
        let right = layout.frame(in: screen, edge: .right)
        expectEqual(right.maxX, screen.maxX)
        expectEqual(right.midY, screen.midY)
        expectEqual(right.size, layout.size)
        let left = layout.frame(in: screen.offsetBy(dx: 100, dy: 40), edge: .left)
        expectEqual(left.minX, 100)
        expectEqual(left.midY, screen.midY + 40)
    }

    test("a strip taller than the screen is cut to the screen") {
        let frame = StripLayout.fitting(count: 40, height: 900).frame(in: screen, edge: .right)
        expectEqual(frame.minY, screen.minY)
        expectEqual(frame.height, screen.height)
    }

    test("finds the creature under a point measured from the strip's top") {
        let layout = StripLayout.fitting(count: 3, height: 900)
        let inset = StripLayout.inset
        expectEqual(layout.index(atY: inset), 0)
        expectEqual(layout.index(atY: inset + 55.9), 0)
        expectEqual(layout.index(atY: inset + 56), 1)
        expectEqual(layout.index(atY: inset + 3 * 56 - 1), 2)
        expectEqual(layout.index(atY: inset - 1), nil)
        expectEqual(layout.index(atY: inset + 3 * 56), nil)
    }

    test("places a cell, and a label beside it facing into the screen") {
        let layout = StripLayout.fitting(count: 3, height: 900)
        let strip = layout.frame(in: screen, edge: .right)
        let cell = layout.cellFrame(1, in: strip)
        expectEqual(cell, CGRect(x: strip.minX + StripLayout.inset, y: strip.maxY - StripLayout.inset - 2 * 56, width: 56, height: 56))

        let label = CGSize(width: 200, height: 40)
        let onRight = StripLayout.labelFrame(size: label, beside: cell, strip: strip, edge: .right)
        expectEqual(onRight.maxX, strip.minX - StripLayout.labelGap)
        expectEqual(onRight.midY, cell.midY)
        let leftStrip = layout.frame(in: screen, edge: .left)
        let onLeft = StripLayout.labelFrame(size: label, beside: layout.cellFrame(1, in: leftStrip), strip: leftStrip, edge: .left)
        expectEqual(onLeft.minX, leftStrip.maxX + StripLayout.labelGap)
    }

    test("inside a cell, the tile leaves one sprite pixel of margin and the sprite sits centred") {
        let layout = StripLayout.fitting(count: 3, height: 900)
        let cell = CGRect(x: 10, y: 20, width: 56, height: 56)
        expectEqual(layout.tileRect(in: cell), CGRect(x: 12, y: 22, width: 52, height: 52))
        expectEqual(layout.spriteRect(in: cell), CGRect(x: 14, y: 24, width: 48, height: 48))
    }
}
