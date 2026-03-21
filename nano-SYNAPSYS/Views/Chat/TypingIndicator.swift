import SwiftUI

struct TypingIndicator: View {
    @State private var isAnimating = false

    var body: some View {
        HStack(spacing: 4) {
            ForEach(0..<3, id: \.self) { index in
                Circle()
                    .fill(Color(red: 0.0, green: 1.0, blue: 0.255))
                    .frame(width: 6, height: 6)
                    .opacity(isAnimating ? 0.2 + Double(index) * 0.3 : 0.2)
                    .animation(
                        Animation
                            .easeInOut(duration: 0.6)
                            .repeatForever(autoreverses: true)
                            .delay(Double(index) * 0.15),
                        value: isAnimating
                    )
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Color(red: 0.0, green: 0.1, blue: 0.0))
        .border(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.4), width: 1)
        .cornerRadius(8)
        .onAppear {
            isAnimating = true
        }
        .onDisappear {
            isAnimating = false
        }
    }
}

#Preview {
    VStack {
        TypingIndicator()
    }
    .padding()
    .background(Color(red: 0.0, green: 0.055, blue: 0.0))
}
