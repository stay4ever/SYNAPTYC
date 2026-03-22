import SwiftUI

struct EncryptionBadge: View {
    var compact: Bool = false
    var isActive: Bool = true

    var body: some View {
        HStack(spacing: 5) {
            Image(systemName: isActive ? "lock.fill" : "lock.open")
                .font(.system(size: compact ? 9 : 10))
            Text(compact ? (isActive ? "E2E" : "…") : (isActive ? Config.App.encryptionLabel : "Establishing encryption…"))
                .font(compact ? .monoSmall : .monoCaption)
                .lineLimit(1)
        }
        .foregroundColor(isActive ? .matrixGreen.opacity(0.8) : .amber)
        .padding(.horizontal, compact ? 6 : 10)
        .padding(.vertical, compact ? 3 : 5)
        .background(Color.darkGreen.opacity(0.4))
        .overlay(
            Capsule().stroke(
                (isActive ? Color.matrixGreen : Color.amber).opacity(0.25),
                lineWidth: 1
            )
        )
        .clipShape(Capsule())
        .accessibilityLabel(isActive ? "End-to-end encryption active" : "Establishing encryption")
        .accessibilityAddTraits(.isStaticText)
    }
}
