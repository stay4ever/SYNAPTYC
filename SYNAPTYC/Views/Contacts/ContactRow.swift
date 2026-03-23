import SwiftUI

struct ContactRow: View {
    let user: AppUser
    let status: ContactRowStatus
    let onAction: (ContactRowAction) -> Void

    var body: some View {
        HStack(spacing: 12) {
            // Avatar
            ZStack(alignment: .bottomTrailing) {
                Circle()
                    .fill(Color.darkGreen)
                    .frame(width: 42, height: 42)
                    .overlay(Circle().stroke(Color.neonGreen.opacity(0.2), lineWidth: 1))
                Text(user.initials)
                    .font(.system(size: 14, weight: .bold, design: .monospaced))
                    .foregroundColor(.neonGreen)
                OnlineDot(isOnline: user.isOnline ?? false, size: 8)
                    .offset(x: 2, y: 2)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(user.name).font(.monoBody).foregroundColor(.neonGreen)
                Text("@\(user.username)").font(.monoCaption).foregroundColor(.matrixGreen)
            }

            Spacer()

            // Action buttons
            switch status {
            case .none:
                Button { onAction(.sendRequest) } label: {
                    Image(systemName: "person.badge.plus")
                        .font(.system(size: 16))
                        .foregroundColor(.neonGreen)
                }
            case .pendingIncoming:
                HStack(spacing: 8) {
                    Button { onAction(.accept) } label: {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.neonGreen)
                    }
                    Button { onAction(.reject) } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(.alertRed)
                    }
                }
            case .pendingOutgoing:
                Text("Pending")
                    .font(.monoCaption)
                    .foregroundColor(.matrixGreen)
            case .accepted:
                Image(systemName: "checkmark.shield.fill")
                    .foregroundColor(.neonGreen.opacity(0.6))
            case .blocked:
                Text("Blocked")
                    .font(.monoCaption)
                    .foregroundColor(.alertRed)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(user.name), @\(user.username), \(user.isOnline == true ? "Online" : "Offline")")
    }
}

enum ContactRowStatus { case none, pendingIncoming, pendingOutgoing, accepted, blocked }
enum ContactRowAction  { case sendRequest, accept, reject, block }
