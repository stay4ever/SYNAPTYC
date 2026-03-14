import SwiftUI

// MARK: - Accessibility helpers

extension View {
    /// Adds a standard accessibility label and hint for interactive elements
    func accessibleButton(label: String, hint: String? = nil) -> some View {
        self
            .accessibilityLabel(label)
            .accessibilityAddTraits(.isButton)
            .accessibilityHint(hint.map { Text($0) } ?? Text(""))
    }

    /// Adds accessibility label for static content
    func accessibleElement(label: String, isHeader: Bool = false) -> some View {
        var view = self.accessibilityLabel(label)
        if isHeader {
            return AnyView(view.accessibilityAddTraits(.isHeader))
        }
        return AnyView(view)
    }
}
