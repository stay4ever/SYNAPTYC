import SwiftUI

// MARK: - Message Bubble (build-76 WhatsApp-style)

struct MessageBubble: View {
    let message: Message
    let isMine: Bool

    var body: some View {
        HStack(alignment: .bottom, spacing: 6) {
            if isMine { Spacer(minLength: 60) }

            VStack(alignment: isMine ? .trailing : .leading, spacing: 4) {
                Text(message.content)
                    .font(.monoBody)
                    .foregroundColor(isMine ? .neonGreen.opacity(0.95) : .matrixGreen.opacity(0.9))
                    .padding(.horizontal, 13)
                    .padding(.vertical, 9)
                    .background(
                        UnevenRoundedRectangle(
                            topLeadingRadius:     isMine ? 18 : 4,
                            bottomLeadingRadius:  18,
                            bottomTrailingRadius: 18,
                            topTrailingRadius:    isMine ? 4 : 18
                        )
                        .fill(isMine ? Color.panelGreen : Color.surfaceGreen)
                        .overlay(
                            UnevenRoundedRectangle(
                                topLeadingRadius:     isMine ? 18 : 4,
                                bottomLeadingRadius:  18,
                                bottomTrailingRadius: 18,
                                topTrailingRadius:    isMine ? 4 : 18
                            )
                            .stroke(
                                isMine ? Color.neonGreen.opacity(0.25) : Color.borderGreen,
                                lineWidth: 1
                            )
                        )
                    )
                    .shadow(color: .black.opacity(0.2), radius: 6, x: 0, y: 2)

                HStack(spacing: 4) {
                    if let exp = message.disappearsAt {
                        Image(systemName: "timer")
                            .font(.system(size: 9))
                            .foregroundColor(.matrixGreen.opacity(0.7))
                        Text(exp, style: .relative)
                            .font(.monoSmall)
                            .foregroundColor(.matrixGreen.opacity(0.7))
                    } else {
                        Text(message.timeString)
                            .font(.monoSmall)
                            .foregroundColor(.matrixGreen.opacity(0.7))
                    }
                    if isMine {
                        Image(systemName: message.read ? "checkmark.circle.fill" : "checkmark.circle")
                            .font(.system(size: 10))
                            .foregroundColor(message.read ? .neonGreen : .matrixGreen.opacity(0.5))
                    }
                }
                .padding(.horizontal, 4)
            }

            if !isMine { Spacer(minLength: 60) }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(isMine ? "You" : "Them"): \(message.content). \(message.timeString). \(isMine ? (message.read ? "Read" : "Delivered") : "")")
    }
}
