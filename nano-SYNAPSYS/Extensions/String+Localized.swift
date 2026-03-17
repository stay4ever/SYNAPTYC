import Foundation

// MARK: - Localization helpers

extension String {
    /// Returns the localized version of this string
    var localized: String {
        NSLocalizedString(self, comment: "")
    }

    /// Returns the localized version with format arguments
    func localized(_ args: CVarArg...) -> String {
        String(format: NSLocalizedString(self, comment: ""), arguments: args)
    }
}
