import SwiftUI

struct OnlineDot: View {
    @State private var isAnimating = false

    var body: some View {
        ZStack {
            Circle()
                .fill(Color(red: 0.0, green: 1.0, blue: 0.255))
                .frame(width: 8, height: 8)

            Circle()
                .stroke(Color(red: 0.0, green: 1.0, blue: 0.255), lineWidth: 1)
                .frame(width: 12, height: 12)
                .scaleEffect(isAnimating ? 1.2 : 1.0)
                .opacity(isAnimating ? 0.3 : 0.6)
        }
        .onAppear {
            withAnimation(Animation.easeInOut(duration: 1.5).repeatForever(autoreverses: true)) {
                isAnimating = true
            }
        }
    }
}

#Preview {
    HStack(spacing: 20) {
        OnlineDot()
        OnlineDot()
        OnlineDot()
    }
    .padding()
    .background(Color(red: 0.0, green: 0.055, blue: 0.0))
}
