import Foundation
import InputMethodKit
import RaycastSwiftMacros

struct KeyboardLayout: Encodable {
    let title: String
    let id: String
    let active: Bool
}

// MARK: - Raycast Exports

@raycast func getEnabledLayouts() -> [KeyboardLayout] {
    let sources = enabledInputSources()
    let current = currentLayoutName()

    return sources.map { source in
        KeyboardLayout(
            title: getLocalizedName(source),
            id: getInputSourceID(source),
            active: getLocalizedName(source) == current
        )
    }
}

@raycast func getCurrentLayout() -> String {
    currentLayoutName()
}

@raycast func selectLayout(name: String) throws -> String {
    let sources = enabledInputSources()

    // Try to find by localized name
    if let source = sources.first(where: { getLocalizedName($0) == name }) {
        if TISSelectInputSource(source) == noErr {
            return "found"
        }
        throw "Failed to select layout \(name)"
    }

    // Try to find by ID
    if let source = sources.first(where: { getInputSourceID($0) == name }) {
        if TISSelectInputSource(source) == noErr {
            return "found"
        }
        throw "Failed to select layout \(name)"
    }

    // Try to find by short ID (last component)
    if let source = sources.first(where: { getInputSourceID($0).components(separatedBy: ".").last == name }) {
        if TISSelectInputSource(source) == noErr {
            return "found"
        }
        throw "Failed to select layout \(name)"
    }

    throw "Layout '\(name)' not found"
}

// MARK: - Private Helpers

private func currentLayoutName() -> String {
    let source = TISCopyCurrentKeyboardInputSource().takeRetainedValue()
    return getLocalizedName(source)
}

private func enabledInputSources() -> [TISInputSource] {
    var sources: [TISInputSource] = []

    // Get keyboard layouts
    if let layouts = TISCreateInputSourceList(
        [kTISPropertyInputSourceType as String: kTISTypeKeyboardLayout as String] as CFDictionary,
        false
    )?.takeRetainedValue() as? [TISInputSource] {
        sources.append(contentsOf: layouts.filter { isEnabled($0) })
    }

    // Get input modes (for languages like Chinese, Japanese)
    if let modes = TISCreateInputSourceList(
        [kTISPropertyInputSourceType as String: kTISTypeKeyboardInputMode as String] as CFDictionary,
        false
    )?.takeRetainedValue() as? [TISInputSource] {
        sources.append(contentsOf: modes.filter { isEnabled($0) })
    }

    return sources
}

private func getLocalizedName(_ source: TISInputSource) -> String {
    Unmanaged<CFString>.fromOpaque(
        TISGetInputSourceProperty(source, kTISPropertyLocalizedName)
    ).takeUnretainedValue() as String
}

private func getInputSourceID(_ source: TISInputSource) -> String {
    Unmanaged<CFString>.fromOpaque(
        TISGetInputSourceProperty(source, kTISPropertyInputSourceID)
    ).takeUnretainedValue() as String
}

private func isEnabled(_ source: TISInputSource) -> Bool {
    let enabled = Unmanaged<NSNumber>.fromOpaque(
        TISGetInputSourceProperty(source, kTISPropertyInputSourceIsEnabled)
    ).takeUnretainedValue()
    return enabled.boolValue
}

extension String: Error {}
