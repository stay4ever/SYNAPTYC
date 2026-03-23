import SwiftUI

struct NeonTextField: View {
    let placeholder: String
    @Binding var text: String
    var isSecure: Bool       = false
    var icon: String?
    var keyboardType: UIKeyboardType = .default
    var autocapitalization: TextInputAutocapitalization = .never
    var fieldIdentifier: String? = nil

    @State private var showPassword = false

    var body: some View {
        HStack(spacing: 10) {
            if let icon {
                Image(systemName: icon)
                    .font(.system(size: 14))
                    .foregroundColor(.matrixGreen)
                    .frame(width: 20)
            }
            SwiftUI.Group {
                if isSecure && !showPassword {
                    SecureField(placeholder, text: $text)
                        .accessibilityIdentifier(fieldIdentifier ?? "")
                } else {
                    TextField(placeholder, text: $text)
                        .keyboardType(keyboardType)
                        .textInputAutocapitalization(autocapitalization)
                        .autocorrectionDisabled()
                        .accessibilityIdentifier(fieldIdentifier ?? "")
                }
            }
            .font(.monoBody)
            .foregroundColor(.neonGreen)
            .tint(.neonGreen)

            if isSecure {
                Button { showPassword.toggle() } label: {
                    Image(systemName: showPassword ? "eye.slash" : "eye")
                        .font(.system(size: 13))
                        .foregroundColor(.matrixGreen)
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(Color.darkGreen.opacity(0.35))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color.neonGreen.opacity(0.25), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .accessibilityElement(children: .contain)
        .accessibilityLabel(placeholder)
    }
}
