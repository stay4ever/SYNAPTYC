import SwiftUI

struct MessageBubble: View {
    let message: Message
    let isMine: Bool

    var body: some View {
        HStack(alignment: .bottom, spacing: 6) {
            if isMine { Spacer(minLength: 60) }

            VStack(alignment: isMine ? .trailing : .leading, spacing: 4) {
                Text(message.content)
                    .font(.monoBody)
                    .foregroundColor(isMine ? .deepBlack : .neonGreen)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(isMine ? Color.neonGreen : Color.darkGreen)
                    .clipShape(BubbleShape(isMine: isMine))
                    .shadow(color: isMine ? Color.neonGreen.opacity(0.2) : .clear, radius: 4)

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

struct BubbleShape: Shape {
    let isMine: Bool
    func path(in rect: CGRect) -> Path {
        let r: CGFloat = 16
        let tail: CGFloat = 6
        var path = Path()
        if isMine {
            path.addRoundedRect(in: CGRect(x: 0, y: 0,
                                           width: rect.width - tail,
                                           height: rect.height),
                                cornerSize: CGSize(width: r, height: r))
        } else {
            path.addRoundedRect(in: CGRect(x: tail, y: 0,
                                           width: rect.width - tail,
                                           height: rect.height),
                                cornerSize: CGSize(width: r, height: r))
        }
        return path
    }
}
