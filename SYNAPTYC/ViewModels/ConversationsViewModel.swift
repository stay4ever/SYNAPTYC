import Foundation
import Combine

@MainActor
final class ConversationsViewModel: ObservableObject {

    // MARK: - Singleton
    // Single shared instance so MainTabView and ConversationsListView observe the same state.
    static let shared = ConversationsViewModel()

    @Published var users: [AppUser]          = []
    @Published var recentConversations: [AppUser] = []
    @Published var isLoading                 = false
    @Published var errorMessage: String?

    /// Unread message counts per sender user ID — drives red notification bubbles.
    /// Persisted to UserDefaults so counts survive app restarts.
    @Published var unreadCounts: [Int: Int]  = {
        let stored = UserDefaults.standard.dictionary(forKey: "unread_counts") as? [String: Int] ?? [:]
        return Dictionary(uniqueKeysWithValues: stored.compactMap { k, v in Int(k).map { ($0, v) } })
    }()

    /// Locally hidden conversation user IDs (persisted across launches)
    @Published var hiddenUserIds: Set<Int>   = {
        let arr = UserDefaults.standard.array(forKey: "hidden_conversations") as? [Int] ?? []
        return Set(arr)
    }()

    private var cancellables = Set<AnyCancellable>()

    private init() {
        // Update online status from user_list events
        WebSocketService.shared.$onlineUserIds
            .receive(on: RunLoop.main)
            .sink { [weak self] onlineIds in
                self?.users = self?.users.map { user in
                    var u = user; u.isOnline = onlineIds.contains(user.id); return u
                } ?? []
            }
            .store(in: &cancellables)

        // Track unread counts for red notification bubbles.
        // Filter out ECDH key-exchange (KEX:) protocol messages — they are not
        // real chat messages and must not increment the badge counter.
        WebSocketService.shared.incomingMessage
            .receive(on: RunLoop.main)
            .sink { [weak self] message in
                guard let self else { return }
                let me = AuthViewModel.shared.currentUser?.id
                guard message.toUser == me,
                      !message.content.isEmpty,
                      !message.content.hasPrefix("KEX:") else { return }
                let count = (self.unreadCounts[message.fromUser] ?? 0) + 1
                self.unreadCounts[message.fromUser] = count
                self.persistUnreadCounts()
            }
            .store(in: &cancellables)
    }

    // MARK: - Computed

    /// Total unread messages across all conversations — drives the CHATS tab badge.
    var totalUnread: Int {
        unreadCounts.values.reduce(0, +)
    }

    // MARK: - Load

    func loadUsers() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let fetched = try await APIService.shared.users()
            let currentId = AuthViewModel.shared.currentUser?.id
            users = fetched.filter { $0.id != currentId }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Unread management

    func clearUnread(for userId: Int) {
        unreadCounts[userId] = nil
        persistUnreadCounts()
    }

    /// Call on logout so stale badge counts are not shown for the next user.
    func reset() {
        users = []
        unreadCounts = [:]
        hiddenUserIds = []
        UserDefaults.standard.removeObject(forKey: "unread_counts")
    }

    // MARK: - Hidden conversations

    func hideConversation(userId: Int) {
        hiddenUserIds.insert(userId)
        UserDefaults.standard.set(Array(hiddenUserIds), forKey: "hidden_conversations")
    }

    func unhideConversation(userId: Int) {
        hiddenUserIds.remove(userId)
        UserDefaults.standard.set(Array(hiddenUserIds), forKey: "hidden_conversations")
    }

    // MARK: - Private

    private func persistUnreadCounts() {
        let stringKeyed = Dictionary(uniqueKeysWithValues: unreadCounts.map { ("\($0.key)", $0.value) })
        UserDefaults.standard.set(stringKeyed, forKey: "unread_counts")
    }
}
