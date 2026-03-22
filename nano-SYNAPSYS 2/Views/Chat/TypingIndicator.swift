import SwiftUI

struct TypingIndicator: View {
    @State private var phase = 0

    var body: some View {
        HStack(spacing: 4) {
            ForEach(0..<3) { i in
                Circle()
                    .fill(Color.matrixGreen)
                    .frame(width: 6, height: 6)
                    .scaleEffect(phase == i ? 1.3 : 0.7)
                    .opacity(phase == i ? 1.0 : 0.4)
                    .animation(.easeInOut(duration: 0.4).delay(Double(i) * 0.15), value: phase)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(Color.darkGreen)
        .clipShape(Capsule())
        .onAppear {
            Timer.scheduledTimer(withTimeInterval: 0.45, repeats: true) { _ in
                phase = (phase + 1) % 3
            }
        }
    }
}
