import SwiftUI

struct ChatView: View {
    let conversation: Conversation
    @StateObject private var viewModel: ChatViewModel
    @State private var messageText = ""
    @Environment(\.dismiss) var dismiss

    init(conversation: Conversation) {
        self.conversation = conversation
        _viewModel = StateObject(wrappedValue: ChatViewModel(contactId: conversation.contact.id))
    }

    var body: some View {
        ZStack {
            Color(red: 0.0, green: 0.055, blue: 0.0)
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Header
                HStack {
                    Button(action: { dismiss() }) {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255))
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        Text(conversation.contact.displayName)
                            .font(.system(.headline, design: .monospaced))
                            .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255))

                        Text(conversation.isOnline ? "ONLINE" : "OFFLINE")
                            .font(.system(size: 11, weight: .regular, design: .monospaced))
                            .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(conversation.isOnline ? 1.0 : 0.5))
                    }

                    Spacer()
                    EncryptionBadge()
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)

                // Messages list
                ScrollViewReader { proxy in
                    List {
                        ForEach(viewModel.messages) { message in
                            MessageBubble(message: message)
                                .listRowBackground(Color.clear)
                                .listRowInsets(EdgeInsets(top: 4, leading: 0, bottom: 4, trailing: 0))
                                .id(message.id)
                        }

                        if viewModel.isRemoteTyping {
                            TypingIndicator()
                                .listRowBackground(Color.clear)
                                .id("typingIndicator")
                        }
                    }
                    .listStyle(.plain)
                    .background(Color.clear)
                    .scrollContentBackground(.hidden)
                    .onChange(of: viewModel.messages.count) {
                        if let last = viewModel.messages.last {
                            withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                        }
                    }
                }

                // Message input
                HStack(spacing: 8) {
                    TextField("MESSAGE...", text: $messageText)
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
                    .disabled(messageText.trimmingCharacters(in: .whitespaces).isEmpty)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Color(red: 0.04, green: 0.1, blue: 0.04).opacity(0.5))
            }
        }
        .navigationBarBackButtonHidden(true)
        .onAppear { viewModel.loadMessages() }
    }
}

#Preview {
    NavigationStack {
        ChatView(conversation: Conversation.mockConversation)
    }
}
