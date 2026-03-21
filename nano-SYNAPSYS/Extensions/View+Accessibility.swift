import SwiftUI

extension View {
    /// Add accessibility label and hint for encrypted content.
    func encryptedAccessibility(label: String) -> some View {
        self
            .accessibilityLabel(label)
            .accessibilityHint("End-to-end encrypted content")
    }

    /// Add accessibility for online status indicators.
    func onlineStatusAccessibility(isOnline: Bool, username: String) -> some View {
        self
            .accessibilityLabel("\(username) is \(isOnline ? "online" : "offline")")
    }
}
