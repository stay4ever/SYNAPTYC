import SwiftUI

struct BotChatView: View {
    @EnvironmentObject var viewModel: BotViewModel
    @State private var messageText = ""

    var body: some View {
        ZStack {
            Color(red: 0.0, green: 0.055, blue: 0.0)
                .ignoresSafeArea()

            VStack(spacing: 0) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("BANNER")
                            .font(.system(.headline, design: .monospaced))
                            .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255))
                        Text("CLAUDE AI ASSISTANT")
                            .font(.system(size: 11, weight: .regular, design: .monospaced))
                            .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.6))
                    }

                    Spacer()

                    Image(systemName: "sparkles")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255))
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)

                ScrollViewReader { proxy in
                    List {
                        ForEach(viewModel.botMessages) { message in
                            BotMessageBubble(message: message)
                                .listRowBackground(Color.clear)
                                .listRowInsets(EdgeInsets(top: 4, leading: 0, bottom: 4, trailing: 0))
                                .id(message.id)
                        }

                        if viewModel.isLoading {
                            HStack(spacing: 8) {
                                ProgressView()
                                    .scaleEffect(0.8)
                                    .tint(Color(red: 0.0, green: 1.0, blue: 0.255))
                                Text("BANNER IS THINKING...")
                                    .font(.system(size: 12, weight: .regular, design: .monospaced))
                                    .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.7))
                                Spacer()
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .listRowBackground(Color.clear)
                            .id("loading")
                        }
                    }
                    .listStyle(.plain)
                    .background(Color.clear)
                    .scrollContentBackground(.hidden)
                    .onChange(of: viewModel.botMessages.count) { _ in
                        if let last = viewModel.botMessages.last {
                            withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                        }
                    }
                }

                HStack(spacing: 8) {
                    TextField("ASK BANNER...", text: $messageText)
                        .font(.system(.body, design: .monospaced))
                        .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                        .background(Color(red: 0.04, green: 0.1, blue: 0.04))
                        .overlay(RoundedRectangle(cornerRadius: 4).stroke(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.3), lineWidth: 1))

                    Button(action: {
                        let text = messageText.trimmingCharacters(in: .whitespaces)
                        guard !text.isEmpty else { return }
                        viewModel.sendMessage(text)
                        messageText = ""
                    }) {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255))
                    }
                    .disabled(messageText.trimmingCharacters(in: .whitespaces).isEmpty || viewModel.isLoading)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Color(red: 0.04, green: 0.1, blue: 0.04).opacity(0.5))
            }
        }
    }
}

struct BotMessageBubble: View {
    let message: BotMessage

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            if !message.isFromUser {
                VStack(alignment: .leading, spacing: 4) {
                    Text("BANNER")
                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                        .foregroundColor(Color(red: 0.2, green: 1.0, blue: 1.0).opacity(0.8))

                    Text(message.content)
                        .font(.system(.body, design: .monospaced))
                        .foregroundColor(Color(red: 0.2, green: 1.0, blue: 1.0))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                        .background(Color(red: 0.0, green: 0.15, blue: 0.15))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(red: 0.2, green: 1.0, blue: 1.0).opacity(0.3), lineWidth: 1))
                        .cornerRadius(8)

                    Text(message.formattedTime)
                        .font(.system(size: 10, weight: .regular, design: .monospaced))
                        .foregroundColor(Color(red: 0.2, green: 1.0, blue: 1.0).opacity(0.5))
                        .padding(.horizontal, 6)
                }
                Spacer()
            } else {
                Spacer()

                VStack(alignment: .trailing, spacing: 4) {
                    Text(message.content)
                        .font(.system(.body, design: .monospaced))
                        .foregroundColor(Color(red: 0.0, green: 0.055, blue: 0.0))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                        .background(Color(red: 0.0, green: 1.0, blue: 0.255))
                        .cornerRadius(8)

                    Text(message.formattedTime)
                        .font(.system(size: 10, weight: .regular, design: .monospaced))
                        .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.5))
                        .padding(.horizontal, 6)
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 4)
        .contentShape(Rectangle())
    }
}

#Preview {
    BotChatView()
        .environmentObject(BotViewModel())
}
