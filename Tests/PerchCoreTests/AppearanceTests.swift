import Foundation
import PerchCore

private let black = RGB(r: 0, g: 0, b: 0)

private func look(_ s: PanelSession, focused: Bool = false, hovered: Bool = false, frame: Int = 1) -> CreatureAppearance {
    CreatureAppearance(session: s, focused: focused, hovered: hovered, frame: frame, now: now)
}

func appearanceTests() {
    test("a plain session is its sprite on a bare tile") {
        let s = session(state: .idle)
        let a = look(s)
        expectEqual(a.tile, Tile())
        expectEqual(a.opacity, 1)
        expectEqual(a.pixels, spriteFrame(character: s.icon.character, color: s.icon.tint, mood: .idle, frame: 1))
    }

    test("hover tints the tile; focus tints it more and rings it") {
        expectEqual(look(session(state: .idle), hovered: true).tile, Tile(fill: .white(0.12)))
        expectEqual(look(session(state: .idle), focused: true).tile, Tile(fill: .white(0.22), border: .white(0.75)))
        expectEqual(look(session(state: .idle), focused: true, hovered: true).tile.fill, .white(0.3))
    }

    test("a permission request blinks the tile in accent once a second, even when focused") {
        for focused in [false, true] {
            let lit = look(session(state: .needsPermission), focused: focused, frame: 0).tile
            let dim = look(session(state: .needsPermission), focused: focused, frame: 2).tile
            expectEqual(lit, Tile(fill: .accent, border: .accent, borderWidth: 2))
            expectEqual(dim, Tile(fill: Paint(rgb: Paint.accent.rgb, alpha: 0.25), border: .accent, borderWidth: 2))
            expectEqual(look(session(state: .needsPermission), focused: focused, frame: 4).tile, lit)
        }
    }

    test("waiting for input rings the tile in accent and pulses its fill") {
        let pulse = (0..<8).map { look(session(state: .needsInput), frame: $0).tile }
        expect(pulse.allSatisfy { $0.border == .accent && $0.borderWidth == 2 })
        expectEqual(pulse[0].fill, Paint(rgb: Paint.accent.rgb, alpha: 0.35))
        expectEqual(pulse[4].fill, Paint(rgb: Paint.accent.rgb, alpha: 0.2))
    }

    test("a finished session is ringed in green until it dozes off, even when it's in front") {
        expectEqual(look(session(state: .done, stateSince: now - 60)).tile, Tile(border: .ready))
        expectEqual(look(session(state: .done, stateSince: now - 60), focused: true).tile, Tile(fill: .white(0.22), border: .ready))
        expectEqual(look(session(state: .done, stateSince: now - 6 * 60)).tile, Tile())
    }

    test("errors ring the tile in the danger color") {
        expectEqual(look(session(state: .error)).tile.border, .danger)
    }

    test("a creature on an accent tile gets a black outline around its sprite") {
        let s = session(state: .needsPermission)
        let plain = spriteFrame(character: s.icon.character, color: s.icon.tint, mood: .alert, frame: 1)
        let outlined = look(s).pixels
        for y in 0..<spriteSize {
            for x in 0..<spriteSize {
                if let c = plain[y][x] { expectEqual(outlined[y][x], c); continue }
                let touches = [(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)].contains { nx, ny in
                    (0..<spriteSize).contains(nx) && (0..<spriteSize).contains(ny) && plain[ny][nx] != nil
                }
                expectEqual(outlined[y][x], touches ? black : nil)
            }
        }
        expect(!look(session(state: .done)).pixels.joined().contains(black), "no outline on a bare tile")
    }

    test("a closed session's creature is grey and faded") {
        let a = look(session(state: .ended, live: false))
        expectEqual(a.opacity, 0.45)
        expect(a.pixels.joined().compactMap { $0 }.allSatisfy { $0.r == $0.g && $0.g == $0.b })
        expect(a.pixels.joined().contains { $0 != nil })
    }

    test("the add button is a plus where creatures stand, on a tile lit by hover") {
        let plain = CreatureAppearance.addButton(hovered: false)
        expectEqual(plain.tile, Tile())
        expectEqual(plain.opacity, 1)
        expectEqual(CreatureAppearance.addButton(hovered: true).tile, Tile(fill: .white(0.12)))

        var lit = Set<[Int]>()
        for (y, row) in plain.pixels.enumerated() {
            for (x, color) in row.enumerated() where color != nil { lit.insert([x, y]) }
        }
        expect(lit.contains([11, 13]) && lit.contains([12, 14]), "the centre is lit")
        expect(lit.allSatisfy { lit.contains([23 - $0[0], $0[1]]) && lit.contains([$0[0], 27 - $0[1]]) }, "mirrored both ways")
        expect(lit.allSatisfy { $0[0] == 11 || $0[0] == 12 || $0[1] == 13 || $0[1] == 14 }, "only the two arms")
    }
}
