import SwiftUI

/// Cyberpunk neon-green Matrix design system for nano-SYNAPSYS
struct AppTheme {
    // MARK: - Colors
    struct Colors {
        // Primary neon green
        static let neonGreen = Color(red: 0.0, green: 1.0, blue: 0.25)  // #00ff41

        // Background
        static let deepBlack = Color(red: 0.0, green: 0.055, blue: 0.0)  // #000e00
        static let darkGray = Color(red: 0.1, green: 0.1, blue: 0.1)
        static let charcoal = Color(red: 0.15, green: 0.15, blue: 0.15)

        // Accents
        static let alertRed = Color(red: 1.0, green: 0.2, blue: 0.2)     // #ff3333
        static let cyan = Color(red: 0.0, green: 1.0, blue: 1.0)
        static let magenta = Color(red: 1.0, green: 0.0, blue: 1.0)

        // Text
        static let neonText = neonGreen
        static let secondaryText = Color(red: 0.5, green: 0.5, blue: 0.5)
        static let mutedText = Color(red: 0.3, green: 0.3, blue: 0.3)

        // Status
        static let online = neonGreen
        static let offline = mutedText
        static let typing = cyan
        static let encrypted = neonGreen
    }

    // MARK: - Typography
    struct Typography {
        // Monospaced fonts for cyberpunk aesthetic
        static let monoTitle = Font.system(size: 28, weight: .bold, design: .monospaced)
        static let monoHeadline = Font.system(size: 20, weight: .semibold, design: .monospaced)
        static let monoBody = Font.system(size: 16, weight: .regular, design: .monospaced)
        static let monoCaption = Font.system(size: 13, weight: .regular, design: .monospaced)
        static let monoSmall = Font.system(size: 11, weight: .regular, design: .monospaced)

        // Large title for splash screen
        static let monoLargeTitle = Font.system(size: 48, weight: .bold, design: .monospaced)
    }

    // MARK: - Spacing
    struct Spacing {
        static let xs: CGFloat = 4
        static let sm: CGFloat = 8
        static let md: CGFloat = 12
        static let lg: CGFloat = 16
        static let xl: CGFloat = 20
        static let xxl: CGFloat = 24
    }

    // MARK: - Corner Radius
    struct CornerRadius {
        static let sm: CGFloat = 4
        static let md: CGFloat = 8
        static let lg: CGFloat = 12
    }
}

// MARK: - View Modifiers

/// Glassmorphism dark card with neon border and glow effect
struct NeonCardModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(AppTheme.Spacing.lg)
            .background(
                RoundedRectangle(cornerRadius: AppTheme.CornerRadius.lg)
                    .fill(
                        LinearGradient(
                            gradient: Gradient(colors: [
                                AppTheme.Colors.darkGray.opacity(0.4),
                                AppTheme.Colors.charcoal.opacity(0.2)
                            ]),
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .background(
                        RoundedRectangle(cornerRadius: AppTheme.CornerRadius.lg)
                            .stroke(
                                AppTheme.Colors.neonGreen.opacity(0.3),
                                lineWidth: 1
                            )
                    )
                    .shadow(color: AppTheme.Colors.neonGreen.opacity(0.2), radius: 8, x: 0, y: 4)
            )
    }
}

extension View {
    func neonCard() -> some View {
        modifier(NeonCardModifier())
    }
}

// MARK: - Text Glow Effect

/// Text glow shadow effect for neon text
struct GlowTextModifier: ViewModifier {
    let color: Color
    let radius: CGFloat

    func body(content: Content) -> some View {
        content
            .shadow(color: color.opacity(0.8), radius: radius / 2, x: 0, y: 0)
            .shadow(color: color.opacity(0.5), radius: radius, x: 0, y: 0)
    }
}

extension View {
    func glowText(color: Color = AppTheme.Colors.neonGreen, radius: CGFloat = 8) -> some View {
        modifier(GlowTextModifier(color: color, radius: radius))
    }
}

// MARK: - Matrix Background

/// Deep black background that ignores safe area
struct MatrixBackgroundModifier: ViewModifier {
    func body(content: Content) -> some View {
        ZStack {
            AppTheme.Colors.deepBlack
                .ignoresSafeArea()

            content
        }
    }
}

extension View {
    func matrixBackground() -> some View {
        modifier(MatrixBackgroundModifier())
    }
}

// MARK: - Additional Modifiers

/// Neon button style with hover/press effects
struct NeonButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(AppTheme.Typography.monoBody)
            .foregroundColor(AppTheme.Colors.deepBlack)
            .padding(.vertical, AppTheme.Spacing.md)
            .padding(.horizontal, AppTheme.Spacing.lg)
            .frame(maxWidth: .infinity)
            .background(
                RoundedRectangle(cornerRadius: AppTheme.CornerRadius.md)
                    .fill(AppTheme.Colors.neonGreen)
            )
            .shadow(
                color: AppTheme.Colors.neonGreen.opacity(
                    configuration.isPressed ? 0.3 : 0.5
                ),
                radius: configuration.isPressed ? 4 : 8,
                x: 0,
                y: 0
            )
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
            .opacity(configuration.isPressed ? 0.9 : 1.0)
    }
}

extension View {
    func neonButtonStyle() -> some View {
        buttonStyle(NeonButtonStyle())
    }
}

/// Neon text field with dark background and neon border
struct NeonTextFieldStyle: TextFieldStyle {
    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
            .font(AppTheme.Typography.monoBody)
            .foregroundColor(AppTheme.Colors.neonText)
            .padding(AppTheme.Spacing.md)
            .background(AppTheme.Colors.charcoal)
            .cornerRadius(AppTheme.CornerRadius.md)
            .overlay(
                RoundedRectangle(cornerRadius: AppTheme.CornerRadius.md)
                    .stroke(AppTheme.Colors.neonGreen.opacity(0.5), lineWidth: 1)
            )
    }
}

extension TextFieldStyle where Self == NeonTextFieldStyle {
    static var neon: NeonTextFieldStyle {
        NeonTextFieldStyle()
    }
}

// MARK: - Message Bubble Modifiers

/// Styling for encrypted message badge
struct EncryptionBadgeModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(AppTheme.Typography.monoCaption)
            .foregroundColor(AppTheme.Colors.neonGreen)
            .padding(.horizontal, AppTheme.Spacing.sm)
            .padding(.vertical, AppTheme.Spacing.xs)
            .background(AppTheme.Colors.charcoal)
            .cornerRadius(AppTheme.CornerRadius.sm)
            .overlay(
                RoundedRectangle(cornerRadius: AppTheme.CornerRadius.sm)
                    .stroke(AppTheme.Colors.neonGreen.opacity(0.4), lineWidth: 0.5)
            )
    }
}

extension View {
    func encryptionBadge() -> some View {
        modifier(EncryptionBadgeModifier())
    }
}

/// Styling for online status indicator dot
struct OnlineDotModifier: ViewModifier {
    let isOnline: Bool

    func body(content: Content) -> some View {
        content
            .foregroundColor(isOnline ? AppTheme.Colors.online : AppTheme.Colors.offline)
            .shadow(
                color: isOnline ? AppTheme.Colors.neonGreen.opacity(0.6) : Color.clear,
                radius: 4,
                x: 0,
                y: 0
            )
    }
}

extension View {
    func onlineDot(isOnline: Bool) -> some View {
        modifier(OnlineDotModifier(isOnline: isOnline))
    }
}

// MARK: - Theme Preview
#if DEBUG
struct AppTheme_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 20) {
            Text("NANO-SYNAPSYS")
                .font(AppTheme.Typography.monoTitle)
                .foregroundColor(AppTheme.Colors.neonGreen)
                .glowText()

            VStack(spacing: 10) {
                Label("Primary", systemImage: "checkmark.circle.fill")
                    .foregroundColor(AppTheme.Colors.neonGreen)
                Label("Alert", systemImage: "exclamationmark.circle.fill")
                    .foregroundColor(AppTheme.Colors.alertRed)
                Label("Cyan", systemImage: "star.circle.fill")
                    .foregroundColor(AppTheme.Colors.cyan)
            }
            .font(AppTheme.Typography.monoBody)
            .neonCard()

            Button("NEON BUTTON") {}
                .neonButtonStyle()

            Spacer()
        }
        .padding()
        .matrixBackground()
    }
}
#endif
