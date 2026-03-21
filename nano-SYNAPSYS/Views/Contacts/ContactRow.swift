import SwiftUI

struct ContactRow: View {
    let contact: Contact

    var body: some View {
        HStack(spacing: 12) {
            // Avatar
            ZStack {
                Circle()
                    .fill(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.1))
                    .border(Color(red: 0.0, green: 1.0, blue: 0.255), width: 1)

                Text(contact.initials)
                    .font(.system(size: 12, weight: .bold, design: .monospaced))
                    .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255))
            }
            .frame(width: 44, height: 44)

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(contact.displayName)
                        .font(.system(.body, weight: .semibold, design: .monospaced))
                        .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255))

                    Spacer()

                    if contact.isOnline {
                        OnlineDot()
                    }
                }

                Text("@\(contact.username)")
                    .font(.system(.caption, design: .monospaced))
                    .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.6))
            }

            Spacer()
        }
        .padding(.vertical, 8)
        .neonCard()
        .contentShape(Rectangle())
    }
}

#Preview {
    VStack(spacing: 8) {
        ContactRow(contact: Contact.mockContact)
        ContactRow(contact: Contact.mockContact)
    }
    .padding()
    .background(Color(red: 0.0, green: 0.055, blue: 0.0))
}
