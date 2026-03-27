import SwiftUI

// MARK: - Conversations List (DMs)

struct ConversationsListView: View {
    @StateObject private var contactsVM = ContactsViewModel()
    @ObservedObject private var convoVM  = ConversationsViewModel.shared
    @State private var searchText        = ""
    @State private var showCompose       = false
    @State private var selectedPeer: AppUser? = nil

    private let columns = [
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12)
    ]

    /// Users to show in the Chats grid:
    ///   1. Accepted contacts (have mutually added each other)
    ///   2. Anyone with an unread badge (received a message from them even without contact)
    /// This ensures messages are always findable regardless of contact status.
    private var chatUsers: [AppUser] {
        var seen = Set<Int>()
        var users: [AppUser] = []

        // 1. Accepted contacts
        for user in contactsVM.acceptedContacts.compactMap({ $0.otherUser }) {
            if seen.insert(user.id).inserted { users.append(user) }
        }

        // 2. Users with unread messages who aren't already in the list
        let unreadSenderIds = convoVM.unreadCounts.keys.filter { $0 != 0 }
        for senderId in unreadSenderIds where !seen.contains(senderId) {
            if let user = contactsVM.allUsers.first(where: { $0.id == senderId }) {
                seen.insert(senderId)
                users.append(user)
            }
        }

        if searchText.isEmpty { return users }
        return users.filter {
            $0.name.localizedCaseInsensitiveContains(searchText) ||
            $0.username.localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottomTrailing) {
                Color.deepBlack.ignoresSafeArea()

                VStack(spacing: 0) {
                    // Pending requests banner
                    if !contactsVM.pendingIncoming.isEmpty {
                        Button { showCompose = true } label: {
                            HStack(spacing: 8) {
                                Image(systemName: "person.crop.circle.badge.clock")
                                    .foregroundColor(.amber)
                                    .font(.system(size: 14))
                                Text("\(contactsVM.pendingIncoming.count) pending contact request\(contactsVM.pendingIncoming.count != 1 ? "s" : "")")
                                    .font(.monoCaption)
                                    .foregroundColor(.amber)
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .font(.system(size: 11, weight: .semibold))
                                    .foregroundColor(.amber.opacity(0.6))
                            }
                            .padding(.horizontal, 16)
                            .padding(.vertical, 10)
                            .background(Color.amber.opacity(0.1))
                        }
                        .buttonStyle(.plain)
                    }

                    // Search bar
                    HStack(spacing: 10) {
                        Image(systemName: "magnifyingglass")
                            .foregroundColor(.matrixGreen.opacity(0.55))
                            .font(.system(size: 14))
                        TextField("Search chats…", text: $searchText)
                            .font(.monoBody)
                            .foregroundColor(.neonGreen)
                            .tint(.neonGreen)
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
                        if !searchText.isEmpty {
                            Button { searchText = "" } label: {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundColor(.matrixGreen.opacity(0.5))
                            }
                        }
                    }
                    .padding(12)
                    .background(Color.black.opacity(0.4))
                    .overlay(RoundedRectangle(cornerRadius: 10)
                        .stroke(Color.neonGreen.opacity(0.15), lineWidth: 1))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)

                    if contactsVM.isLoading && contactsVM.acceptedContacts.isEmpty {
                        Spacer()
                        ProgressView().tint(.neonGreen)
                        Spacer()
                    } else if chatUsers.isEmpty {
                        Spacer()
                        VStack(spacing: 16) {
                            Image(systemName: "bubble.left.and.bubble.right")
                                .font(.system(size: 40))
                                .foregroundColor(.matrixGreen.opacity(0.3))
                            Text(searchText.isEmpty ? "No contacts yet" : "No match")
                                .font(.monoHeadline)
                                .foregroundColor(.matrixGreen.opacity(0.6))
                            if searchText.isEmpty {
                                Text("Tap the pencil icon to find people")
                                    .font(.monoCaption)
                                    .foregroundColor(.matrixGreen.opacity(0.4))
                            }
                        }
                        Spacer()
                    } else {
                        ScrollView {
                            LazyVGrid(columns: columns, spacing: 12) {
                                ForEach(chatUsers) { user in
                                    Button {
                                        convoVM.clearUnread(for: user.id)
                                        selectedPeer = user
                                    } label: {
                                        ConversationCard(
                                            user: user,
                                            unread: convoVM.unreadCounts[user.id] ?? 0
                                        )
                                    }
                                    .buttonStyle(.plain)
                                    .contextMenu {
                                        Button(role: .destructive) {
                                            // Nothing to hide — contacts managed in Contacts tab
                                        } label: {
                                            Label("Open Chat", systemImage: "bubble.left")
                                        }
                                    }
                                }
                            }
                            .padding(.horizontal, 14)
                            .padding(.bottom, 20)
                        }
                        .refreshable { await contactsVM.load() }
                    }
                }

                // Compose button — opens Contacts to find people / manage requests
                Button { showCompose = true } label: {
                    ZStack {
                        Circle()
                            .fill(Color.darkGreen.opacity(0.75))
                            .frame(width: 50, height: 50)
                            .overlay(Circle().stroke(Color.neonGreen.opacity(0.4), lineWidth: 1))
                            .shadow(color: Color.neonGreen.opacity(0.25), radius: 8)
                        Image(systemName: "square.and.pencil")
                            .font(.system(size: 20, weight: .semibold))
                            .foregroundColor(.neonGreen)
                    }
                }
                .padding(.trailing, 18)
                .padding(.bottom, 16)
                .accessibilityLabel("Find people")
            }
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Text("CHATS")
                        .font(.monoHeadline)
                        .foregroundColor(.neonGreen)
                        .glowText()
                }
            }
        }
        .task { await contactsVM.load() }
        .sheet(isPresented: $showCompose) {
            ContactsView()
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
        .sheet(item: $selectedPeer) { peer in
            NavigationStack { ChatView(peer: peer) }
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
    }
}

// MARK: - Conversation Card (square grid tile)

struct ConversationCard: View {
    let user: AppUser
    let unread: Int

    private var isOnline: Bool { user.isOnline ?? false }

    var body: some View {
        ZStack(alignment: .topTrailing) {
            VStack(spacing: 10) {
                // Avatar
                ZStack {
                    if let urlStr = user.avatarURL,
                       let url = urlStr.hasPrefix("http") ? URL(string: urlStr) : URL(string: Config.baseURL + urlStr) {
                        AsyncImage(url: url) { phase in
                            switch phase {
                            case .success(let img):
                                img.resizable().scaledToFill()
                                    .frame(width: 52, height: 52).clipShape(Circle())
                                    .overlay(Circle().stroke(
                                        isOnline ? Color.neonGreen.opacity(0.8) : Color.gray.opacity(0.25),
                                        lineWidth: isOnline ? 2 : 1))
                            default:
                                initialsCircle(user: user)
                            }
                        }
                    } else {
                        initialsCircle(user: user)
                    }

                    // Online dot
                    if isOnline {
                        Circle()
                            .fill(Color.neonGreen)
                            .frame(width: 10, height: 10)
                            .overlay(Circle().stroke(Color(white: 0.08), lineWidth: 1.5))
                            .shadow(color: .neonGreen.opacity(0.8), radius: 3)
                            .offset(x: 18, y: 18)
                    } else {
                        Circle()
                            .fill(Color.gray.opacity(0.3))
                            .frame(width: 9, height: 9)
                            .overlay(Circle().stroke(Color(white: 0.08), lineWidth: 1))
                            .offset(x: 18, y: 18)
                    }
                }

                // Name
                Text(user.name)
                    .font(.monoCaption).fontWeight(.semibold)
                    .foregroundColor(isOnline ? .neonGreen : .matrixGreen.opacity(0.7))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)

                // Status
                Text(isOnline ? "online" : "@\(user.username)")
                    .font(.monoSmall)
                    .foregroundColor(isOnline ? .neonGreen.opacity(0.6) : .matrixGreen.opacity(0.4))
                    .lineLimit(1)
            }
            .padding(.vertical, 16)
            .padding(.horizontal, 10)
            .frame(maxWidth: .infinity)
            .background(
                ZStack {
                    RoundedRectangle(cornerRadius: 20)
                        .fill(LinearGradient(
                            colors: [Color(white: 0.18), Color(white: 0.07)],
                            startPoint: .topLeading, endPoint: .bottomTrailing))
                    RoundedRectangle(cornerRadius: 20)
                        .fill(LinearGradient(
                            colors: [Color(white: 1.0, opacity: 0.09), Color.clear],
                            startPoint: .top, endPoint: .center))
                    RoundedRectangle(cornerRadius: 20)
                        .stroke(
                            isOnline ? Color.neonGreen.opacity(0.35) : Color.neonGreen.opacity(0.08),
                            lineWidth: isOnline ? 1.5 : 1)
                }
            )
            .shadow(
                color: isOnline ? Color.neonGreen.opacity(0.12) : Color.black.opacity(0.4),
                radius: isOnline ? 8 : 5, x: 0, y: 3)

            // Unread badge
            if unread > 0 {
                ZStack {
                    Circle()
                        .fill(Color.red)
                        .frame(width: 22, height: 22)
                        .shadow(color: Color.red.opacity(0.6), radius: 4)
                    Text("\(min(unread, 99))")
                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                        .foregroundColor(.white)
                }
                .offset(x: -6, y: 6)
                .transition(.scale.combined(with: .opacity))
            }
        }
        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: unread)
    }

    private func initialsCircle(user: AppUser) -> some View {
        ZStack {
            Circle()
                .fill(LinearGradient(
                    colors: [Color.darkGreen, Color(white: 0.05)],
                    startPoint: .topLeading, endPoint: .bottomTrailing))
                .frame(width: 52, height: 52)
                .overlay(Circle().stroke(
                    isOnline ? Color.neonGreen.opacity(0.8) : Color.gray.opacity(0.25),
                    lineWidth: isOnline ? 2 : 1))
            Text(user.initials)
                .font(.system(size: 18, weight: .bold, design: .monospaced))
                .foregroundColor(isOnline ? .neonGreen : .matrixGreen.opacity(0.5))
        }
    }
}

// Legacy alias
typealias ConversationRow = ConversationCard
