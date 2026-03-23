import SwiftUI

struct ConversationsListView: View {
    @StateObject private var vm = ConversationsViewModel()
    @State private var searchText    = ""
    @State private var selectedUser: AppUser?
    @State private var showBotChat   = false

    private let columns = [
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12)
    ]

    var filtered: [AppUser] {
        if searchText.isEmpty { return vm.users }
        return vm.users.filter {
            $0.name.localizedCaseInsensitiveContains(searchText) ||
            $0.username.localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                // Metallic background
                MetallicBackground()

                VStack(spacing: 0) {
                    // Search bar
                    HStack(spacing: 10) {
                        Image(systemName: "magnifyingglass")
                            .foregroundColor(.matrixGreen)
                            .font(.system(size: 14))
                        TextField("Search users…", text: $searchText)
                            .font(.monoBody)
                            .foregroundColor(.neonGreen)
                            .tint(.neonGreen)
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
                        if !searchText.isEmpty {
                            Button { searchText = "" } label: {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundColor(.matrixGreen.opacity(0.6))
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

                    if vm.isLoading && vm.users.isEmpty {
                        Spacer()
                        ProgressView().tint(.neonGreen)
                        Spacer()
                    } else {
                        ScrollView {
                            LazyVGrid(columns: columns, spacing: 12) {
                                // Banner AI card (always first)
                                Button { showBotChat = true } label: {
                                    BotCard()
                                }
                                .buttonStyle(.plain)

                                // User cards
                                if filtered.isEmpty && !searchText.isEmpty {
                                    // empty search result spans both columns
                                    VStack(spacing: 8) {
                                        Image(systemName: "magnifyingglass")
                                            .font(.system(size: 24))
                                            .foregroundColor(.matrixGreen.opacity(0.3))
                                        Text("No match")
                                            .font(.monoCaption)
                                            .foregroundColor(.matrixGreen.opacity(0.5))
                                    }
                                    .frame(maxWidth: .infinity)
                                    .padding(.top, 20)
                                } else {
                                    ForEach(filtered) { user in
                                        Button {
                                            vm.clearUnread(for: user.id)
                                            selectedUser = user
                                        } label: {
                                            ConversationCard(
                                                user: user,
                                                unread: vm.unreadCounts[user.id] ?? 0
                                            )
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                            }
                            .padding(.horizontal, 14)
                            .padding(.bottom, 20)
                        }
                        .refreshable { await vm.loadUsers() }
                    }
                }
            }
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    VStack(spacing: 1) {
                        Text("SYNAPTYC")
                            .font(.monoHeadline)
                            .foregroundColor(.neonGreen)
                            .glowText()
                        Text("E2E ENCRYPTED")
                            .font(.system(size: 8, design: .monospaced))
                            .foregroundColor(.matrixGreen.opacity(0.7))
                            .tracking(2)
                    }
                }
            }
        }
        .task { await vm.loadUsers() }
        // Slide-up chat sheet
        .sheet(item: $selectedUser) { user in
            ChatView(peer: user)
        }
        .sheet(isPresented: $showBotChat) {
            BotChatView()
        }
    }
}

// MARK: - Metallic background

struct MetallicBackground: View {
    var body: some View {
        ZStack {
            // Base dark gradient
            LinearGradient(
                colors: [Color(white: 0.11), Color(white: 0.05)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            // Subtle vertical gloss band
            LinearGradient(
                colors: [Color(white: 1.0, opacity: 0.04), Color.clear],
                startPoint: .top,
                endPoint: .center
            )
            // Fine noise texture via repeating diagonal lines (lightweight)
            Canvas { ctx, size in
                var y: CGFloat = 0
                while y < size.height {
                    var path = Path()
                    path.move(to: CGPoint(x: 0, y: y))
                    path.addLine(to: CGPoint(x: size.width, y: y))
                    ctx.stroke(path, with: .color(white: 1.0, opacity: 0.012), lineWidth: 1)
                    y += 3
                }
            }
        }
        .ignoresSafeArea()
    }
}

// MARK: - Conversation Card

struct ConversationCard: View {
    let user: AppUser
    let unread: Int

    var body: some View {
        ZStack(alignment: .topTrailing) {
            VStack(spacing: 10) {
                // Avatar
                ZStack {
                    Circle()
                        .fill(
                            LinearGradient(
                                colors: [Color.darkGreen, Color(white: 0.05)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 52, height: 52)
                        .overlay(
                            Circle().stroke(
                                user.isOnline == true
                                    ? Color.neonGreen.opacity(0.6)
                                    : Color.neonGreen.opacity(0.2),
                                lineWidth: 1.5
                            )
                        )
                    Text(user.initials)
                        .font(.system(size: 18, weight: .bold, design: .monospaced))
                        .foregroundColor(.neonGreen)

                    // Online pulse
                    if user.isOnline == true {
                        Circle()
                            .fill(Color.neonGreen)
                            .frame(width: 9, height: 9)
                            .overlay(Circle().stroke(Color(white: 0.1), lineWidth: 1.5))
                            .offset(x: 18, y: 18)
                    }
                }

                // Name
                Text(user.name)
                    .font(.monoCaption).fontWeight(.semibold)
                    .foregroundColor(.neonGreen)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)

                // Username / status
                Text(user.isOnline == true ? "online" : "@\(user.username)")
                    .font(.monoSmall)
                    .foregroundColor(.matrixGreen)
                    .lineLimit(1)
            }
            .padding(.vertical, 16)
            .padding(.horizontal, 10)
            .frame(maxWidth: .infinity)
            // Glossy metallic card background
            .background(
                ZStack {
                    RoundedRectangle(cornerRadius: 20)
                        .fill(
                            LinearGradient(
                                colors: [Color(white: 0.18), Color(white: 0.07)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                    // Top gloss highlight
                    RoundedRectangle(cornerRadius: 20)
                        .fill(
                            LinearGradient(
                                colors: [Color(white: 1.0, opacity: 0.09), Color.clear],
                                startPoint: .top,
                                endPoint: .center
                            )
                        )
                    RoundedRectangle(cornerRadius: 20)
                        .stroke(Color.neonGreen.opacity(0.15), lineWidth: 1)
                }
            )
            .shadow(color: Color.black.opacity(0.5), radius: 6, x: 0, y: 3)

            // Red notification bubble
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
}

// MARK: - Bot Card

struct BotCard: View {
    var body: some View {
        VStack(spacing: 10) {
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [Color.darkGreen, Color(white: 0.05)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 52, height: 52)
                    .overlay(Circle().stroke(Color.neonGreen.opacity(0.5), lineWidth: 1.5))
                Image(systemName: "cpu.fill")
                    .font(.system(size: 22))
                    .foregroundColor(.neonGreen)
            }

            Text("Banner AI")
                .font(.monoCaption).fontWeight(.semibold)
                .foregroundColor(.neonGreen)

            PulsatingDot(color: .neonGreen, size: 5)
        }
        .padding(.vertical, 16)
        .padding(.horizontal, 10)
        .frame(maxWidth: .infinity)
        .background(
            ZStack {
                RoundedRectangle(cornerRadius: 20)
                    .fill(
                        LinearGradient(
                            colors: [Color(white: 0.18), Color(white: 0.07)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                RoundedRectangle(cornerRadius: 20)
                    .fill(
                        LinearGradient(
                            colors: [Color(white: 1.0, opacity: 0.09), Color.clear],
                            startPoint: .top,
                            endPoint: .center
                        )
                    )
                RoundedRectangle(cornerRadius: 20)
                    .stroke(Color.neonGreen.opacity(0.25), lineWidth: 1)
            }
        )
        .shadow(color: Color.black.opacity(0.5), radius: 6, x: 0, y: 3)
    }
}

// Keep old row types available for any remaining references
typealias ConversationRow = ConversationCard
