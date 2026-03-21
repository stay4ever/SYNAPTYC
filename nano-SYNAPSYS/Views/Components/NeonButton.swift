import SwiftUI

struct NeonButton: View {
    let title: String
    var isLoading = false
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if isLoading {
                    ProgressView()
                        .scaleEffect(0.8)
                        .tint(Color(red: 0.0, green: 0.055, blue: 0.0))
                }

                Text(title)
                    .font(.system(size: 17, weight: .bold, design: .monospaced))
                    .frame(maxWidth: .infinity)
            }
            .foregroundColor(Color(red: 0.0, green: 0.055, blue: 0.0))
            .padding(.vertical, 14)
            .background(Color(red: 0.0, green: 1.0, blue: 0.255))
            .cornerRadius(4)
            .shadow(color: Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.5), radius: 8)
        }
        .disabled(isLoading)
        .hapticFeedback()
    }
}

extension View {
    func hapticFeedback() -> some View {
        self.onTapGesture {
            let impact = UIImpactFeedbackGenerator(style: .light)
            impact.impactOccurred()
        }
    }
}

#Preview {
    VStack(spacing: 16) {
        NeonButton(title: "BUTTON", action: {})

        NeonButton(title: "LOADING...", isLoading: true, action: {})

        NeonButton(title: "DISABLED", action: {})
            .disabled(true)
    }
    .padding()
    .background(Color(red: 0.0, green: 0.055, blue: 0.0))
}
