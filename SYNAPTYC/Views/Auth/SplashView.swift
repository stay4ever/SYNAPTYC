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
                // ── Neon vault logo ───────────────────────────────────────
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

                    VaultLogo()
                        .frame(width: 60, height: 60)
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

// MARK: - Vault Logo (shared between SplashView and LoginView)
// Canvas-drawn vault door in the neon-green Matrix aesthetic.

struct VaultLogo: View {
    var body: some View {
        Canvas { ctx, size in
            let w = size.width
            let h = size.height
            let green  = Color.neonGreen
            let dimmed = Color.neonGreen.opacity(0.35)
            let fill   = Color.neonGreen.opacity(0.07)
            let lw: CGFloat = 2.0

            // ── Outer vault door frame ──────────────────────────────────
            let margin: CGFloat = w * 0.04
            let frameRect = CGRect(x: margin, y: margin,
                                   width: w - margin * 2, height: h - margin * 2)
            let frameRadius: CGFloat = w * 0.12
            let frameShape = Path(roundedRect: frameRect, cornerRadius: frameRadius)
            ctx.fill(frameShape, with: .color(fill))
            ctx.stroke(frameShape, with: .color(green), style: StrokeStyle(lineWidth: lw))

            // ── Hinge rectangles (left side) ───────────────────────────
            let hingeW: CGFloat = w * 0.10
            let hingeH: CGFloat = h * 0.14
            let hingeX: CGFloat = margin
            for yFrac in [CGFloat(0.25), CGFloat(0.62)] {
                let hingeRect = CGRect(x: hingeX, y: h * yFrac - hingeH / 2,
                                      width: hingeW, height: hingeH)
                let hinge = Path(roundedRect: hingeRect, cornerRadius: 2)
                ctx.fill(hinge, with: .color(dimmed.opacity(0.4)))
                ctx.stroke(hinge, with: .color(dimmed), style: StrokeStyle(lineWidth: 1))
            }

            // ── Bolt holes (right side) ─────────────────────────────────
            let boltR: CGFloat = w * 0.045
            let boltX: CGFloat = w - margin - boltR * 1.2
            for yFrac in [CGFloat(0.28), CGFloat(0.50), CGFloat(0.72)] {
                let boltRect = CGRect(x: boltX - boltR, y: h * yFrac - boltR,
                                     width: boltR * 2, height: boltR * 2)
                let bolt = Path(ellipseIn: boltRect)
                ctx.fill(bolt, with: .color(dimmed.opacity(0.5)))
                ctx.stroke(bolt, with: .color(green), style: StrokeStyle(lineWidth: 1))
            }

            // ── Central locking wheel ───────────────────────────────────
            let cx = w * 0.50, cy = h * 0.50
            let outerR: CGFloat = w * 0.26
            let innerR: CGFloat = w * 0.13
            let hubR:   CGFloat = w * 0.06

            let outerWheel = Path(ellipseIn: CGRect(x: cx - outerR, y: cy - outerR,
                                                    width: outerR * 2, height: outerR * 2))
            ctx.fill(outerWheel, with: .color(fill))
            ctx.stroke(outerWheel, with: .color(green), style: StrokeStyle(lineWidth: lw))

            let innerWheel = Path(ellipseIn: CGRect(x: cx - innerR, y: cy - innerR,
                                                    width: innerR * 2, height: innerR * 2))
            ctx.stroke(innerWheel, with: .color(dimmed), style: StrokeStyle(lineWidth: 1))

            // Spokes (4 at 45°, 90°, 135°, 180°)
            for deg in stride(from: 0.0, through: 135.0, by: 45.0) {
                let rad = deg * .pi / 180.0
                let x1 = cx + CGFloat(cos(rad)) * innerR
                let y1 = cy + CGFloat(sin(rad)) * innerR
                let x2 = cx - CGFloat(cos(rad)) * innerR
                let y2 = cy - CGFloat(sin(rad)) * innerR
                var spoke = Path()
                spoke.move(to: CGPoint(x: x1, y: y1))
                spoke.addLine(to: CGPoint(x: x2, y: y2))
                ctx.stroke(spoke, with: .color(dimmed), style: StrokeStyle(lineWidth: 1.2))
            }

            let hub = Path(ellipseIn: CGRect(x: cx - hubR, y: cy - hubR,
                                             width: hubR * 2, height: hubR * 2))
            ctx.fill(hub, with: .color(green.opacity(0.25)))
            ctx.stroke(hub, with: .color(green), style: StrokeStyle(lineWidth: lw))
        }
        .shadow(color: .neonGreen.opacity(0.5), radius: 10)
    }
}
