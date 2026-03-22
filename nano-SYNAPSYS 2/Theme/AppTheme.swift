import SwiftUI

// MARK: - Colour palette
extension Color {
    static let neonGreen   = Color(hex: "#00ff41")
    static let deepBlack   = Color(hex: "#000e00")
    static let darkGreen   = Color(hex: "#001a00")
    static let matrixGreen = Color(hex: "#00aa00")
    static let dimGreen    = Color(hex: "#004400")
    static let alertRed    = Color(hex: "#ff3333")
    static let amber       = Color(hex: "#fbbf24")

    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: (a, r, g, b) = (255, (int >> 8)*17, (int >> 4 & 0xF)*17, (int & 0xF)*17)
        case 6: (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:(a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(.sRGB, red: Double(r)/255, green: Double(g)/255, blue: Double(b)/255, opacity: Double(a)/255)
    }
}

// MARK: - Typography
extension Font {
    static let monoTitle = Font.system(.title2, design: .monospaced).weight(.bold)
    static let monoHeadline = Font.system(.headline, design: .monospaced).weight(.semibold)
    static let monoBody = Font.system(.body, design: .monospaced)
    static let monoCaption = Font.system(.caption, design: .monospaced)
    static let monoSmall = Font.system(size: 11, design: .monospaced)
}

// MARK: - ViewModifiers
struct NeonCardModifier: ViewModifier {
    var intensity: Double = 1.0
    func body(content: Content) -> some View {
        content
            .background(Color.darkGreen.opacity(0.5))
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(Color.neonGreen.opacity(0.3 * intensity), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .shadow(color: Color.neonGreen.opacity(0.08 * intensity), radius: 8)
    }
}

struct GlowTextModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .shadow(color: Color.neonGreen.opacity(0.6), radius: 4)
            .shadow(color: Color.neonGreen.opacity(0.3), radius: 8)
    }
}

extension View {
    func neonCard(intensity: Double = 1.0) -> some View {
        modifier(NeonCardModifier(intensity: intensity))
    }
    func glowText() -> some View {
        modifier(GlowTextModifier())
    }
    func matrixBackground() -> some View {
        background(Color.deepBlack.ignoresSafeArea())
    }
}

// MARK: - Scanline overlay (decorative)
struct ScanlineOverlay: View {
    var body: some View {
        LinearGradient(
            colors: [Color.neonGreen.opacity(0.02), Color.clear],
            startPoint: .top,
            endPoint: .bottom
        )
        .ignoresSafeArea()
        .allowsHitTesting(false)
    }
}

// MARK: - Pulse animation
struct PulsatingDot: View {
    let color: Color
    let size: CGFloat
    @State private var pulsing = false

    var body: some View {
        ZStack {
            Circle()
                .fill(color.opacity(0.3))
                .frame(width: size * 2, height: size * 2)
                .scaleEffect(pulsing ? 1.4 : 1.0)
                .opacity(pulsing ? 0 : 0.6)
                .animation(.easeOut(duration: 1.2).repeatForever(autoreverses: false), value: pulsing)
            Circle()
                .fill(color)
                .frame(width: size, height: size)
        }
        .onAppear { pulsing = true }
    }
}
