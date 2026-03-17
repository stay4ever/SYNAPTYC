import SwiftUI

struct OnlineDot: View {
    let isOnline: Bool
    var size: CGFloat = 9

    var body: some View {
        if isOnline {
            PulsatingDot(color: .neonGreen, size: size)
                .accessibilityLabel("Online")
        } else {
            Circle()
                .fill(Color.gray.opacity(0.4))
                .frame(width: size, height: size)
                .accessibilityLabel("Offline")
        }
    }
}
