import SwiftUI

struct EncryptionBadge: View {
    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "lock.fill")
                .font(.system(size: 12, weight: .semibold))

            Text("E2E")
                .font(.system(size: 11, weight: .bold, design: .monospaced))
        }
        .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255))
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.1))
        .border(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.5), width: 1)
        .cornerRadius(4)
        .shadow(color: Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.4), radius: 4)
    }
}

#Preview {
    VStack(spacing: 12) {
        EncryptionBadge()

        HStack(spacing: 12) {
            EncryptionBadge()
            Spacer()
        }
    }
    .padding()
    .background(Color(red: 0.0, green: 0.055, blue: 0.0))
}
