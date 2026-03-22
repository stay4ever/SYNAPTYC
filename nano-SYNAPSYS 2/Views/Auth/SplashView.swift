import SwiftUI

struct SplashView: View {
    @State private var opacity    = 0.0
    @State private var scale      = 0.85
    @State private var glitching  = false

    var body: some View {
        ZStack {
            Color.deepBlack.ignoresSafeArea()
            ScanlineOverlay()

            VStack(spacing: 24) {
                // Logo mark
                ZStack {
                    Circle()
                        .stroke(Color.neonGreen.opacity(0.15), lineWidth: 1)
                        .frame(width: 110, height: 110)
                    Circle()
                        .stroke(Color.neonGreen.opacity(0.3), lineWidth: 1)
                        .frame(width: 88, height: 88)
                    Image(systemName: "lock.shield.fill")
                        .font(.system(size: 40))
                        .foregroundColor(.neonGreen)
                        .shadow(color: .neonGreen, radius: 10)
                }

                VStack(spacing: 6) {
                    Text("nano-SYNAPSYS")
                        .font(.system(size: 26, weight: .black, design: .monospaced))
                        .foregroundColor(.neonGreen)
                        .glowText()
                        .offset(x: glitching ? 2 : 0)

                    Text("ENCRYPTED · PRIVATE · SECURE")
                        .font(.monoSmall)
                        .foregroundColor(.matrixGreen)
                        .tracking(3)
                }

                EncryptionBadge()
            }
            .scaleEffect(scale)
            .opacity(opacity)
            .onAppear {
                withAnimation(.easeOut(duration: 0.7)) {
                    opacity = 1; scale = 1
                }
                // Glitch effect
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
                    withAnimation(.linear(duration: 0.06).repeatCount(4, autoreverses: true)) {
                        glitching = true
                    }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { glitching = false }
                }
            }
        }
    }
}
