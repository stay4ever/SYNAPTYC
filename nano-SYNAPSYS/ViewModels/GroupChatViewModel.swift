import Foundation
import Combine

@MainActor
class GroupChatViewModel: ObservableObject {
    @Published var messages: [GroupMessage] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var isRemoteTyping = false

    let groupId: String
    private var cancellables = Set<AnyCancellable>()

    init(groupID: String) {
        self.groupId = groupID
        subscribeToWebSocket()
    }

    func loadMessages() {
        Task {
            isLoading = true
            errorMessage = nil
            do {
                let msgs = try await APIService.shared.getGroupMessages(groupId: groupId)
                self.messages = msgs.sorted { $0.timestamp < $1.timestamp }
            } catch {
                errorMessage = "Failed to load group messages: \(error.localizedDescription)"
            }
            isLoading = false
        }
    }

    func sendMessage(_ content: String) {
        Task {
            do {
                let message = try await APIService.shared.sendGroupMessage(
                    groupId: groupId,
                    content: content
                )
                messages.append(message)
            } catch {
                errorMessage = "Failed to send group message: \(error.localizedDescription)"
            }
        }
    }

    private func subscribeToWebSocket() {
        WebSocketService.shared.groupMessagePublisher
            .receive(on: DispatchQueue.main)
            .filter { [weak self] event in event.groupId == self?.groupId }
            .sink { [weak self] event in
                // Convert GroupMessageEvent to GroupMessage for display
                let msg = GroupMessage(
                    id: event.messageId, groupId: event.groupId,
                    senderId: event.senderId, senderUsername: nil,
                    content: event.content,
                    timestamp: Date(timeIntervalSince1970: event.timestamp),
                    isRead: false
                )
                self?.messages.append(msg)
            }
            .store(in: &cancellables)
    }
}
