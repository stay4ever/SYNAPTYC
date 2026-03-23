import Foundation
import Combine

@MainActor
final class ConversationsViewModel: ObservableObject {
    @Published var users: [AppUser]          = []
    @Published var recentConversations: [AppUser] = []
    @Published var isLoading                 = false
    @Published var errorMessage: String?
    /// Unread message counts per sender user ID — drives red notification bubbles
    @Published var unreadCounts: [Int: Int]  = [:]
    /// Locally hidden conversation user IDs (persisted across launches)
    @Published var hiddenUserIds: Set<Int>   = {
        let arr = UserDefaults.standard.array(forKey: "hidden_conversations") as? [Int] ?? []
        return Set(arr)
    }()

    private var cancellables = Set<AnyCancellable>()

    init() {
        // Update online status from user_list events
        WebSocketService.shared.$onlineUserIds
            .receive(on: RunLoop.main)
            .sink { [weak self] onlineIds in
                self?.users = self?.users.map { user in
                    var u = user; u.isOnline = onlineIds.contains(user.id); return u
                } ?? []
            }
            .store(in: &cancellables)

        // Track unread counts for red notification bubbles
        WebSocketService.shared.$incomingMessage
            .compactMap { $0 }
            .receive(on: RunLoop.main)
            .sink { [weak self] message in
                guard let self else { return }
                let me = AuthViewModel.shared.currentUser?.id
                // Only count messages sent TO the current user
                guard message.toUser == me, !message.content.isEmpty else { return }
                let count = (self.unreadCounts[message.fromUser] ?? 0) + 1
                self.unreadCounts[message.fromUser] = count
            }
            .store(in: &cancellables)
    }

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

    func clearUnread(for userId: Int) {
        unreadCounts[userId] = nil
    }

    func hideConversation(userId: Int) {
        hiddenUserIds.insert(userId)
        UserDefaults.standard.set(Array(hiddenUserIds), forKey: "hidden_conversations")
    }

    func unhideConversation(userId: Int) {
        hiddenUserIds.remove(userId)
        UserDefaults.standard.set(Array(hiddenUserIds), forKey: "hidden_conversations")
    }
}
