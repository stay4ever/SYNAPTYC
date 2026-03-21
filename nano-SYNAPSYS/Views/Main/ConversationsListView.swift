import SwiftUI

struct ConversationsListView: View {
    @EnvironmentObject var viewModel: ConversationsViewModel
    @State private var searchText = ""

    var filteredConversations: [Conversation] {
        if searchText.isEmpty { return viewModel.conversations }
        return viewModel.conversations.filter { conversation in
            conversation.contact.displayName.localizedCaseInsensitiveContains(searchText) ||
            conversation.contact.username.localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        ZStack {
            Color(red: 0.0, green: 0.055, blue: 0.0)
                .ignoresSafeArea()

            VStack(spacing: 0) {
                VStack(spacing: 12) {
                    HStack {
                        Text("MESSAGES")
                            .font(.system(size: 24, weight: .bold, design: .monospaced))
                            .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255))
                        Spacer()
                    }

                    HStack(spacing: 8) {
                        Image(systemName: "magnifyingglass")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.5))

                        TextField("SEARCH", text: $searchText)
                            .font(.system(size: 17, design: .monospaced))
                            .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255))
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .background(Color(red: 0.04, green: 0.1, blue: 0.04))
                    .overlay(RoundedRectangle(cornerRadius: 4).stroke(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.3), lineWidth: 1))
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)

                if filteredConversations.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "bubble.left.dashed")
                            .font(.system(size: 48, weight: .light))
                            .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.3))
                        Text("NO CONVERSATIONS")
                            .font(.system(size: 14, weight: .bold, design: .monospaced))
                            .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.5))
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .padding(.top, 60)
                } else {
                    List {
                        ForEach(filteredConversations) { conversation in
                            NavigationLink(destination: ChatView(conversation: conversation)) {
                                ConversationRow(conversation: conversation)
                            }
                            .listRowBackground(Color.clear)
                            .listRowInsets(EdgeInsets(top: 4, leading: 12, bottom: 4, trailing: 12))
                        }
                    }
                    .listStyle(.plain)
                    .background(Color.clear)
                    .scrollContentBackground(.hidden)
                    .refreshable {
                        await viewModel.refreshConversations()
                    }
                }

                Spacer()
            }
        }
        .onAppear {
            viewModel.loadConversations()
        }
    }
}

struct ConversationRow: View {
    let conversation: Conversation

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.1))
                    .overlay(Circle().stroke(Color(red: 0.0, green: 1.0, blue: 0.255), lineWidth: 1))

                Text(conversation.contact.initials)
                    .font(.system(size: 12, weight: .bold, design: .monospaced))
                    .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255))
            }
            .frame(width: 44, height: 44)

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(conversation.contact.displayName)
                        .font(.system(size: 17, weight: .semibold, design: .monospaced))
                        .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255))

                    Spacer()

                    Text(conversation.lastMessageTime)
                        .font(.system(size: 11, weight: .regular, design: .monospaced))
                        .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.5))
                }

                Text(conversation.lastMessage)
                    .font(.system(size: 14, design: .monospaced))
                    .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.6))
                    .lineLimit(1)
            }

            Spacer()

            if conversation.isOnline {
                OnlineDot()
            }
        }
        .padding(.vertical, 8)
        .contentShape(Rectangle())
    }
}

#Preview {
    NavigationStack {
        ConversationsListView()
            .environmentObject(ConversationsViewModel())
    }
}
