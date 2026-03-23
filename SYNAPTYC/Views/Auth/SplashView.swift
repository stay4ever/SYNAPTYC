import SwiftUI

struct SplashView: View {
    @State private var opacity   = 0.0
    @State private var scale     = 0.85
    @State private var glitching = false
    @State private var ringPulse = false

    var body: some View {
        ZStack {
            Color.deepBlack.ignoresSafeArea()
            ScanlineOverlay()

            VStack(spacing: 28) {
                // ── Neon chat-bubbles logo (build-75 design) ──────────────
                ZStack {
                    // Outer pulse ring
                    Circle()
                        .stroke(Color.neonGreen.opacity(ringPulse ? 0 : 0.18), lineWidth: 1)
                        .frame(width: 130, height: 130)
                        .scaleEffect(ringPulse ? 1.25 : 1.0)
                        .animation(.easeOut(duration: 1.4).repeatForever(autoreverses: false), value: ringPulse)

                    Circle()
                        .stroke(Color.neonGreen.opacity(0.25), lineWidth: 1)
                        .frame(width: 100, height: 100)

                    // Chat bubbles icon
                    ChatBubblesLogo()
                        .frame(width: 56, height: 46)
                        .accessibilityIdentifier("splash_logo")
                }

                VStack(spacing: 6) {
                    Text("SYNAPTYC")
                        .font(.system(size: 28, weight: .black, design: .monospaced))
                        .foregroundColor(.neonGreen)
                        .glowText()
                        .offset(x: glitching ? 2 : 0)

                    Text("ENCRYPTED · PRIVATE · SECURE")
                        .font(.monoSmall)
                        .foregroundColor(.matrixGreen)
                        .tracking(3)
                }

            }
            .scaleEffect(scale)
            .opacity(opacity)
            .onAppear {
                withAnimation(.easeOut(duration: 0.7)) {
                    opacity = 1; scale = 1
                }
                ringPulse = true
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

// MARK: - Chat Bubbles Logo (native drawn, matching build-75 aesthetic)

struct ChatBubblesLogo: View {
    var body: some View {
        Canvas { ctx, size in
            let w = size.width
            let h = size.height
            let accent = Color.neonGreen
            let dim    = Color.neonGreen.opacity(0.45)

            // Left bubble (incoming)
            let leftBubble = Path { p in
                let r: CGFloat = 9
                let bx: CGFloat = 0, by: CGFloat = h * 0.26
                let bw: CGFloat = w * 0.58, bh: CGFloat = h * 0.44
                p.move(to: CGPoint(x: bx + r, y: by))
                p.addLine(to: CGPoint(x: bx + bw - r, y: by))
                p.addArc(center: CGPoint(x: bx + bw - r, y: by + r), radius: r,
                         startAngle: .degrees(-90), endAngle: .degrees(0), clockwise: false)
                p.addLine(to: CGPoint(x: bx + bw, y: by + bh - r))
                p.addArc(center: CGPoint(x: bx + bw - r, y: by + bh - r), radius: r,
                         startAngle: .degrees(0), endAngle: .degrees(90), clockwise: false)
                // Tail bottom-left
                p.addLine(to: CGPoint(x: bx + 18, y: by + bh))
                p.addLine(to: CGPoint(x: bx, y: by + bh + 8))
                p.addLine(to: CGPoint(x: bx + r, y: by + bh))
                p.addLine(to: CGPoint(x: bx + r, y: by + bh))
                p.addArc(center: CGPoint(x: bx + r, y: by + bh - r), radius: r,
                         startAngle: .degrees(90), endAngle: .degrees(180), clockwise: false)
                p.addLine(to: CGPoint(x: bx, y: by + r))
                p.addArc(center: CGPoint(x: bx + r, y: by + r), radius: r,
                         startAngle: .degrees(180), endAngle: .degrees(270), clockwise: false)
            }
            ctx.fill(leftBubble, with: .color(dim.opacity(0.18)))
            ctx.stroke(leftBubble, with: .color(dim), lineWidth: 1.5)

            // Right bubble (outgoing)
            let rightBubble = Path { p in
                let r: CGFloat = 9
                let bx: CGFloat = w * 0.38, by: CGFloat = 0
                let bw: CGFloat = w * 0.62, bh: CGFloat = h * 0.46
                p.move(to: CGPoint(x: bx + r, y: by))
                p.addLine(to: CGPoint(x: bx + bw - r, y: by))
                p.addArc(center: CGPoint(x: bx + bw - r, y: by + r), radius: r,
                         startAngle: .degrees(-90), endAngle: .degrees(0), clockwise: false)
                p.addLine(to: CGPoint(x: bx + bw, y: by + bh - r))
                p.addArc(center: CGPoint(x: bx + bw - r, y: by + bh - r), radius: r,
                         startAngle: .degrees(0), endAngle: .degrees(90), clockwise: false)
                p.addLine(to: CGPoint(x: bx + r, y: by + bh))
                p.addArc(center: CGPoint(x: bx + r, y: by + bh - r), radius: r,
                         startAngle: .degrees(90), endAngle: .degrees(180), clockwise: false)
                p.addLine(to: CGPoint(x: bx, y: by + r))
                p.addArc(center: CGPoint(x: bx + r, y: by + r), radius: r,
                         startAngle: .degrees(180), endAngle: .degrees(270), clockwise: false)
                // Tail bottom-right
                p.move(to: CGPoint(x: bx + bw - 18, y: by + bh))
                p.addLine(to: CGPoint(x: bx + bw, y: by + bh + 8))
                p.addLine(to: CGPoint(x: bx + bw - r, y: by + bh))
            }
            ctx.fill(rightBubble, with: .color(accent.opacity(0.12)))
            ctx.stroke(rightBubble, with: .color(accent), lineWidth: 1.5)

            // Lock dot inside right bubble (encryption indicator)
            let lockCenter = CGPoint(x: bx_right(w) + rw(w) * 0.5, y: h * 0.22)
            let lockPath = Path(ellipseIn: CGRect(x: lockCenter.x - 3, y: lockCenter.y - 3, width: 6, height: 6))
            ctx.fill(lockPath, with: .color(accent))
        }
        .shadow(color: .neonGreen.opacity(0.5), radius: 8)
    }

    private func bx_right(_ w: CGFloat) -> CGFloat { w * 0.38 }
    private func rw(_ w: CGFloat) -> CGFloat { w * 0.62 }
}
