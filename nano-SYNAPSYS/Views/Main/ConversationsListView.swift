import SwiftUI

struct ConversationsListView: View {
    @StateObject private var vm  = ConversationsViewModel()
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
                    }
                    .padding(12)
                    .background(Color.darkGreen.opacity(0.3))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color.neonGreen.opacity(0.15), lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)

                    if vm.isLoading && vm.users.isEmpty {
                        Spacer()
                        ProgressView().tint(.neonGreen)
                        Spacer()
                    } else {
                        ScrollView {
                            LazyVStack(spacing: 0) {
                                // Banner bot entry
                                NavigationLink(destination: BotChatView()) {
                                    BotRowView()
                                }
                                .buttonStyle(.plain)

                                Divider().background(Color.neonGreen.opacity(0.08))

                                ForEach(filtered) { user in
                                    NavigationLink(destination: ChatView(peer: user)) {
                                        ConversationRow(user: user)
                                    }
                                    .buttonStyle(.plain)
                                    Divider().background(Color.neonGreen.opacity(0.08))
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
                    Text("nano-SYNAPSYS")
                        .font(.monoHeadline)
                        .foregroundColor(.neonGreen)
                        .glowText()
                }
            }
        }
        .task { await vm.loadUsers() }
    }
}

struct ConversationRow: View {
    let user: AppUser
    var body: some View {
        HStack(spacing: 14) {
            ZStack(alignment: .bottomTrailing) {
                Circle()
                    .fill(Color.darkGreen)
                    .frame(width: 46, height: 46)
                    .overlay(Circle().stroke(Color.neonGreen.opacity(0.25), lineWidth: 1))
                Text(user.initials)
                    .font(.system(size: 16, weight: .bold, design: .monospaced))
                    .foregroundColor(.neonGreen)
                OnlineDot(isOnline: user.isOnline ?? false)
                    .offset(x: 2, y: 2)
            }
            .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 3) {
                Text(user.name)
                    .font(.monoBody).fontWeight(.semibold)
                    .foregroundColor(.neonGreen)
                Text("@\(user.username)")
                    .font(.monoCaption)
                    .foregroundColor(.matrixGreen)
            }
            Spacer()
            EncryptionBadge(compact: true)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(user.name), @\(user.username), \(user.isOnline == true ? "Online" : "Offline"), Encrypted")
    }
}

struct BotRowView: View {
    var body: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle()
                    .fill(Color.darkGreen)
                    .frame(width: 46, height: 46)
                    .overlay(Circle().stroke(Color.neonGreen.opacity(0.4), lineWidth: 1))
                Image(systemName: "cpu.fill")
                    .font(.system(size: 18))
                    .foregroundColor(.neonGreen)
            }
            .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 3) {
                Text("Banner AI").font(.monoBody).fontWeight(.semibold).foregroundColor(.neonGreen)
                Text("AI assistant — always online").font(.monoCaption).foregroundColor(.matrixGreen)
            }
            Spacer()
            PulsatingDot(color: .neonGreen, size: 7)
                .accessibilityHidden(true)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Banner AI, AI assistant, always online")
    }
}
