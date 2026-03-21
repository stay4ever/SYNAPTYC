import Foundation

extension String {
    /// Return the localized version of this string key.
    var localized: String {
        NSLocalizedString(self, comment: "")
    }

    /// Return the localized string with format arguments.
    func localized(_ args: CVarArg...) -> String {
        String(format: NSLocalizedString(self, comment: ""), arguments: args)
    }
}
