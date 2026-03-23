import SwiftUI

struct ConversationsListView: View {
    @StateObject private var vm = ConversationsViewModel()
    @State private var searchText = ""

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
                Color.deepBlack.ignoresSafeArea()
                ScanlineOverlay()

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
                                    .font(.system(size: 14))
                            }
                        }
                    }
                    .padding(12)
                    .background(Color.darkGreen.opacity(0.3))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(Color.neonGreen.opacity(0.15), lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)

                    if vm.isLoading && vm.users.isEmpty {
                        Spacer()
                        ProgressView().tint(.neonGreen)
                        Spacer()
                    } else {
                        ScrollView {
                            LazyVStack(spacing: 0) {
                                // Banner AI entry (always first)
                                NavigationLink(destination: BotChatView()) {
                                    BotRowView()
                                }
                                .buttonStyle(.plain)

                                Divider().background(Color.neonGreen.opacity(0.08))

                                if filtered.isEmpty && !searchText.isEmpty {
                                    VStack(spacing: 10) {
                                        Image(systemName: "magnifyingglass")
                                            .font(.system(size: 28))
                                            .foregroundColor(.matrixGreen.opacity(0.3))
                                        Text("No users match \"\(searchText)\"")
                                            .font(.monoCaption)
                                            .foregroundColor(.matrixGreen.opacity(0.5))
                                    }
                                    .frame(maxWidth: .infinity)
                                    .padding(.top, 40)
                                } else {
                                    ForEach(filtered) { user in
                                        NavigationLink(destination: ChatView(peer: user)) {
                                            ConversationRow(user: user)
                                        }
                                        .buttonStyle(.plain)
                                        Divider().background(Color.neonGreen.opacity(0.08))
                                    }
                                }
                            }
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
    }
}

// MARK: - Conversation Row

struct ConversationRow: View {
    let user: AppUser

    var body: some View {
        HStack(spacing: 14) {
            // Avatar with online indicator
            ZStack(alignment: .bottomTrailing) {
                Circle()
                    .fill(Color.darkGreen)
                    .frame(width: 50, height: 50)
                    .overlay(
                        Circle().stroke(
                            user.isOnline == true
                                ? Color.neonGreen.opacity(0.5)
                                : Color.neonGreen.opacity(0.2),
                            lineWidth: 1.5
                        )
                    )
                Text(user.initials)
                    .font(.system(size: 17, weight: .bold, design: .monospaced))
                    .foregroundColor(.neonGreen)
                OnlineDot(isOnline: user.isOnline ?? false)
                    .offset(x: 2, y: 2)
            }
            .accessibilityHidden(true)

            // Name + status line
            VStack(alignment: .leading, spacing: 4) {
                Text(user.name)
                    .font(.monoBody).fontWeight(.semibold)
                    .foregroundColor(.neonGreen)
                HStack(spacing: 5) {
                    Image(systemName: "lock.fill")
                        .font(.system(size: 9))
                        .foregroundColor(.matrixGreen.opacity(0.6))
                    Text(user.isOnline == true ? "online" : "@\(user.username)")
                        .font(.monoCaption)
                        .foregroundColor(.matrixGreen)
                }
            }

            Spacer()

            // Online/offline timestamp column
            VStack(alignment: .trailing, spacing: 4) {
                EncryptionBadge(compact: true)
                if user.isOnline == true {
                    Text("now")
                        .font(.monoSmall)
                        .foregroundColor(.neonGreen.opacity(0.6))
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 13)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(user.name), @\(user.username), \(user.isOnline == true ? "Online" : "Offline"), Encrypted")
    }
}

// MARK: - Bot Row

struct BotRowView: View {
    var body: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle()
                    .fill(Color.darkGreen)
                    .frame(width: 50, height: 50)
                    .overlay(Circle().stroke(Color.neonGreen.opacity(0.5), lineWidth: 1.5))
                Image(systemName: "cpu.fill")
                    .font(.system(size: 20))
                    .foregroundColor(.neonGreen)
            }
            .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 4) {
                Text("Banner AI")
                    .font(.monoBody).fontWeight(.semibold)
                    .foregroundColor(.neonGreen)
                Text("AI assistant · Claude-powered")
                    .font(.monoCaption)
                    .foregroundColor(.matrixGreen)
            }

            Spacer()

            PulsatingDot(color: .neonGreen, size: 7)
                .accessibilityHidden(true)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 13)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Banner AI, AI assistant, always online")
    }
}
