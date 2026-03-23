import SwiftUI

struct NeonButton: View {
    let title: String
    let icon: String?
    var isLoading: Bool = false
    var style: NeonButtonStyle = .primary
    let action: () -> Void

    init(_ title: String, icon: String? = nil, isLoading: Bool = false,
         style: NeonButtonStyle = .primary, action: @escaping () -> Void) {
        self.title = title; self.icon = icon
        self.isLoading = isLoading; self.style = style; self.action = action
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if isLoading {
                    ProgressView().tint(style.foreground).scaleEffect(0.8)
                } else if let icon {
                    Image(systemName: icon).font(.system(size: 14, weight: .semibold))
                }
                Text(title).font(.monoBody).fontWeight(.semibold)
            }
            .foregroundColor(style.foreground)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(style.background)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(style.border, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .shadow(color: style.glow, radius: 6)
        }
        .disabled(isLoading)
        .accessibilityLabel(title)
        .accessibilityAddTraits(.isButton)
        .accessibilityHint(isLoading ? "Loading" : "")
    }
}

enum NeonButtonStyle {
    case primary, secondary, danger

    var foreground: Color {
        switch self {
        case .primary: return .neonGreen
        case .secondary: return .matrixGreen
        case .danger: return .alertRed
        }
    }
    var background: Color {
        switch self {
        case .primary: return Color.darkGreen.opacity(0.5)
        case .secondary: return Color.dimGreen.opacity(0.3)
        case .danger: return Color.red.opacity(0.12)
        }
    }
    var border: Color {
        switch self {
        case .primary: return Color.neonGreen.opacity(0.5)
        case .secondary: return Color.matrixGreen.opacity(0.3)
        case .danger: return Color.alertRed.opacity(0.5)
        }
    }
    var glow: Color {
        switch self {
        case .primary: return Color.neonGreen.opacity(0.2)
        case .secondary: return .clear
        case .danger: return Color.red.opacity(0.15)
        }
    }
}
