import SwiftUI

struct MessageBubble: View {
    let message: Message

    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            if message.isFromCurrentUser {
                Spacer()

                VStack(alignment: .trailing, spacing: 4) {
                    Text(message.content)
                        .font(.system(.body, design: .monospaced))
                        .foregroundColor(Color(red: 0.0, green: 0.055, blue: 0.0))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                        .background(Color(red: 0.0, green: 1.0, blue: 0.255))
                        .cornerRadius(8)

                    HStack(spacing: 6) {
                        Image(systemName: message.isRead ? "checkmark.double" : "checkmark")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(message.isRead ? 1.0 : 0.6))

                        Text(message.formattedTime)
                            .font(.system(size: 10, weight: .regular, design: .monospaced))
                            .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.5))
                    }
                    .padding(.horizontal, 6)
                }
            } else {
                VStack(alignment: .leading, spacing: 4) {
                    Text(message.content)
                        .font(.system(.body, design: .monospaced))
                        .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                        .background(Color(red: 0.0, green: 0.1, blue: 0.0))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.4), lineWidth: 1))
                        .cornerRadius(8)

                    Text(message.formattedTime)
                        .font(.system(size: 10, weight: .regular, design: .monospaced))
                        .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.5))
                        .padding(.horizontal, 6)
                }

                Spacer()
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 4)
        .contentShape(Rectangle())
    }
}

#Preview {
    VStack(spacing: 12) {
        MessageBubble(message: Message.mockSentMessage)
        MessageBubble(message: Message.mockReceivedMessage)
    }
    .padding()
    .background(Color(red: 0.0, green: 0.055, blue: 0.0))
}
