import SwiftUI

struct ContactRow: View {
    let user: AppUser
    let status: ContactRowStatus
    var inPhoneContacts: Bool = false
    let onAction: (ContactRowAction) -> Void

    private var isOnline: Bool { user.isOnline ?? false }

    private var avatarCircle: some View {
        ZStack {
            Circle()
                .fill(isOnline ? Color.darkGreen : Color.darkGreen.opacity(0.5))
                .frame(width: 42, height: 42)
                .overlay(Circle().stroke(
                    isOnline ? Color.neonGreen.opacity(0.7) : Color.gray.opacity(0.25),
                    lineWidth: isOnline ? 2 : 1
                ))
            Text(user.initials)
                .font(.system(size: 14, weight: .bold, design: .monospaced))
                .foregroundColor(isOnline ? .neonGreen : .matrixGreen.opacity(0.5))
        }
    }

    private func resolvedURL(_ urlStr: String) -> URL? {
        if urlStr.hasPrefix("http") { return URL(string: urlStr) }
        return URL(string: Config.baseURL + urlStr)
    }

    var body: some View {
        HStack(spacing: 12) {
            // Avatar — photo if available, initials fallback
            ZStack(alignment: .bottomTrailing) {
                if let urlStr = user.avatarURL, let url = resolvedURL(urlStr) {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let img):
                            img.resizable().scaledToFill()
                                .frame(width: 42, height: 42)
                                .clipShape(Circle())
                                .overlay(Circle().stroke(
                                    isOnline ? Color.neonGreen.opacity(0.7) : Color.gray.opacity(0.25),
                                    lineWidth: isOnline ? 2 : 1
                                ))
                        default:
                            avatarCircle
                        }
                    }
                } else {
                    avatarCircle
                }
                OnlineDot(isOnline: isOnline, size: 8)
                    .offset(x: 2, y: 2)
            }

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(user.name)
                        .font(.monoBody)
                        .foregroundColor(isOnline ? .neonGreen : .matrixGreen.opacity(0.7))
                    if inPhoneContacts {
                        Image(systemName: "phone.fill")
                            .font(.system(size: 9))
                            .foregroundColor(.neonGreen.opacity(0.5))
                    }
                }
                HStack(spacing: 4) {
                    Text("@\(user.username)").font(.monoCaption).foregroundColor(.matrixGreen.opacity(0.6))
                    if isOnline {
                        Text("· online")
                            .font(.monoCaption)
                            .foregroundColor(.neonGreen.opacity(0.7))
                    }
                }
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
