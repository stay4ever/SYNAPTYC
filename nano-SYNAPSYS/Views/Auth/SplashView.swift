import SwiftUI

struct SplashView: View {
    @State private var isAnimating = false
    @State private var dismiss = false

    var body: some View {
        ZStack {
            // Deep black background
            Color(red: 0.0, green: 0.055, blue: 0.0)
                .ignoresSafeArea()

            VStack(spacing: 24) {
                Spacer()

                // App name with glow animation
                VStack(spacing: 8) {
                    Text("NANO-SYNAPSYS")
                        .font(.system(size: 48, weight: .bold, design: .monospaced))
                        .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255))
                        .shadow(color: Color(red: 0.0, green: 1.0, blue: 0.255).opacity(isAnimating ? 0.8 : 0.3), radius: isAnimating ? 20 : 10)
                        .scaleEffect(isAnimating ? 1.05 : 1.0)

                    // Subtitle
                    Text("ENCRYPTED COMMUNICATIONS")
                        .font(.system(size: 14, weight: .medium, design: .monospaced))
                        .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.7))
                        .letterSpacing(2)
                }

                Spacer()

                // Loading animation
                HStack(spacing: 4) {
                    ForEach(0..<3, id: \.self) { index in
                        Circle()
                            .fill(Color(red: 0.0, green: 1.0, blue: 0.255))
                            .frame(width: 8, height: 8)
                            .opacity(isAnimating ? Double(index) * 0.3 + 0.3 : 0.3)
                            .animation(.easeInOut(duration: 1.2).repeatForever(), value: isAnimating)
                    }
                }
                .padding(.bottom, 60)
            }
        }
        .onAppear {
            isAnimating = true
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                dismiss = true
            }
        }
        .fullScreenCover(isPresented: $dismiss) {
            ContentView()
        }
    }
}

#Preview {
    SplashView()
}
