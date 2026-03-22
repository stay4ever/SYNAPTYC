import Foundation
import Combine

@MainActor
final class ConversationsViewModel: ObservableObject {
    @Published var users: [AppUser]          = []
    @Published var recentConversations: [AppUser] = []
    @Published var isLoading                 = false
    @Published var errorMessage: String?

    private var cancellables = Set<AnyCancellable>()

    init() {
        // React to incoming WebSocket messages
        WebSocketService.shared.$incomingMessage
            .compactMap { $0 }
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in Task { await self?.loadUsers() } }
            .store(in: &cancellables)

        WebSocketService.shared.$onlineUserIds
            .receive(on: RunLoop.main)
            .sink { [weak self] onlineIds in
                self?.users = self?.users.map { user in
                    var u = user; u.isOnline = onlineIds.contains(user.id); return u
                } ?? []
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

    func unreadCount(for userId: Int, messages: [Message]) -> Int {
        guard let me = AuthViewModel.shared.currentUser else { return 0 }
        return messages.filter { $0.fromUser == userId && $0.toUser == me.id && !$0.read }.count
    }
}
