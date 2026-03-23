import SwiftUI

// MARK: - Message Bubble (build-76 WhatsApp-style)

struct MessageBubble: View {
    let message: Message
    let isMine: Bool
    var onDelete: (() -> Void)? = nil

    var body: some View {
        HStack(alignment: .bottom, spacing: 6) {
            if isMine { Spacer(minLength: 60) }

            VStack(alignment: isMine ? .trailing : .leading, spacing: 4) {
                Text(message.content)
                    .font(.system(.body))
                    .foregroundColor(isMine ? .neonGreen : Color.white.opacity(0.9))
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(
                        UnevenRoundedRectangle(
                            topLeadingRadius:     isMine ? 18 : 4,
                            bottomLeadingRadius:  18,
                            bottomTrailingRadius: 18,
                            topTrailingRadius:    isMine ? 4 : 18
                        )
                        .fill(isMine ? Color.panelGreen : Color.surfaceGreen)
                    )

                HStack(spacing: 4) {
                    if let exp = message.disappearsAt {
                        Image(systemName: "timer")
                            .font(.system(size: 9))
                            .foregroundColor(.matrixGreen.opacity(0.6))
                        Text(exp, style: .relative)
                            .font(.system(size: 11))
                            .foregroundColor(.matrixGreen.opacity(0.6))
                    } else {
                        Text(message.timeString)
                            .font(.system(size: 11))
                            .foregroundColor(.matrixGreen.opacity(0.6))
                    }
                    if isMine {
                        MessageTicks(read: message.read)
                    }
                }
                .padding(.horizontal, 4)
            }

            if !isMine { Spacer(minLength: 60) }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(isMine ? "You" : "Them"): \(message.content). \(message.timeString). \(isMine ? (message.read ? "Read" : "Sent") : "")")
        .contextMenu {
            if isMine, let onDelete {
                Button(role: .destructive) {
                    onDelete()
                } label: {
                    Label("Delete", systemImage: "trash")
                }
            }
        }
    }
}

// MARK: - Delivery ticks
// Double grey ticks = sent to server (unread)
// Double green ticks = read by peer

struct MessageTicks: View {
    let read: Bool

    var body: some View {
        HStack(spacing: -4) {
            Image(systemName: "checkmark")
                .font(.system(size: 10, weight: .semibold))
                .foregroundColor(read ? .neonGreen : .matrixGreen.opacity(0.45))
            Image(systemName: "checkmark")
                .font(.system(size: 10, weight: .semibold))
                .foregroundColor(read ? .neonGreen : .matrixGreen.opacity(0.45))
        }
        .animation(.easeInOut(duration: 0.2), value: read)
    }
}
