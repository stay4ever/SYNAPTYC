import SwiftUI

struct NeonTextField: View {
    let placeholder: String
    @Binding var text: String
    let isSecure: Bool

    var body: some View {
        if isSecure {
            SecureField(placeholder, text: $text)
                .font(.system(.body, design: .monospaced))
                .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255))
                .padding(.horizontal, 12)
                .padding(.vertical, 12)
                .background(Color(red: 0.04, green: 0.1, blue: 0.04))
                .border(Color(red: 0.0, green: 1.0, blue: 0.255), width: 1)
                .cornerRadius(4)
        } else {
            TextField(placeholder, text: $text)
                .font(.system(.body, design: .monospaced))
                .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255))
                .padding(.horizontal, 12)
                .padding(.vertical, 12)
                .background(Color(red: 0.04, green: 0.1, blue: 0.04))
                .border(Color(red: 0.0, green: 1.0, blue: 0.255), width: 1)
                .cornerRadius(4)
        }
    }
}

#Preview {
    VStack(spacing: 12) {
        NeonTextField(placeholder: "USERNAME", text: .constant(""), isSecure: false)

        NeonTextField(placeholder: "PASSWORD", text: .constant(""), isSecure: true)
    }
    .padding()
    .background(Color(red: 0.0, green: 0.055, blue: 0.0))
}
