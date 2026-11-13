import Carbon.HIToolbox
import Foundation
import TomariCore

/// The global ⌃⌥J shortcut that opens the session that has waited longest for the user.
/// Carbon's hot keys need no Accessibility permission.
@MainActor
final class JumpHotKey {
    private let link: AgentLink
    private var hotKey: EventHotKeyRef?
    private var handler: EventHandlerRef?
    /// The only instance the C callback reaches; there is one hot key per process.
    private static weak var active: JumpHotKey?

    /// True while the combination is registered.
    var isRegistered: Bool { hotKey != nil }

    init(link: AgentLink) {
        self.link = link
    }

    /// Returns false, after logging, when the system refuses (e.g. another app holds ⌃⌥J).
    @discardableResult
    func register() -> Bool {
        guard hotKey == nil else { return true }
        var spec = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))
        var installed: EventHandlerRef?
        let status = InstallEventHandler(GetApplicationEventTarget(), { _, _, _ in
            MainActor.assumeIsolated { JumpHotKey.active?.pressed() }
            return noErr
        }, 1, &spec, nil, &installed)
        guard status == noErr else { return failed("install handler", status) }

        var ref: EventHotKeyRef?
        let id = EventHotKeyID(signature: OSType(0x544F4D41) /* "TOMA" */, id: 1)
        let registered = RegisterEventHotKey(UInt32(kVK_ANSI_J), UInt32(controlKey | optionKey), id, GetApplicationEventTarget(), 0, &ref)
        guard registered == noErr, ref != nil else {
            if let installed { RemoveEventHandler(installed) }
            return failed("register ⌃⌥J", registered)
        }
        hotKey = ref
        handler = installed
        Self.active = self
        return true
    }

    func unregister() {
        if let hotKey { UnregisterEventHotKey(hotKey) }
        if let handler { RemoveEventHandler(handler) }
        hotKey = nil
        handler = nil
        if Self.active === self { Self.active = nil }
    }

    private func pressed() {
        guard let id = WaitingJump.target(in: Array(link.list.sessions.values), focusedId: link.list.focusedId) else { return }
        link.send(.open(id: id))
    }

    private func failed(_ what: String, _ status: OSStatus) -> Bool {
        FileHandle.standardError.write(Data("tomari-overlay: could not \(what) (OSStatus \(status))\n".utf8))
        return false
    }
}
