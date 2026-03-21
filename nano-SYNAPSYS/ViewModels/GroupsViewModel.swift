import Foundation
import Combine

@MainActor
class GroupsViewModel: ObservableObject {
    @Published var groups: [Group] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    private var cancellables = Set<AnyCancellable>()

    init() {
        subscribeToWebSocket()
    }

    // MARK: - Load Groups

    func loadGroups() async {
        isLoading = true
        errorMessage = nil

        do {
            let allGroups = try await APIService.shared.getGroups()
            self.groups = allGroups.sorted { $0.name < $1.name }
            isLoading = false
        } catch {
            errorMessage = "Failed to load groups: \(error.localizedDescription)"
            isLoading = false
        }
    }

    // MARK: - Create Group

    func createGroup(name: String, memberIds: [String]) async {
        errorMessage = nil

        do {
            let newGroup = try await APIService.shared.createGroup(name: name, memberIds: memberIds)
            groups.append(newGroup)
            groups.sort { $0.name < $1.name }
        } catch {
            errorMessage = "Failed to create group: \(error.localizedDescription)"
        }
    }

    // MARK: - Leave Group

    func leaveGroup(id: String) async {
        errorMessage = nil

        do {
            try await APIService.shared.leaveGroup(id: id)
            groups.removeAll { $0.id == id }
        } catch {
            errorMessage = "Failed to leave group: \(error.localizedDescription)"
        }
    }

    // MARK: - Delete Group (Owner only)

    func deleteGroup(id: String) async {
        errorMessage = nil

        do {
            try await APIService.shared.deleteGroup(id: id)
            groups.removeAll { $0.id == id }
        } catch {
            errorMessage = "Failed to delete group: \(error.localizedDescription)"
        }
    }

    // MARK: - WebSocket Subscription

    private func subscribeToWebSocket() {
        WebSocketService.shared.groupUpdate
            .receive(on: DispatchQueue.main)
            .sink { [weak self] event in
                self?.handleGroupUpdate(event)
            }
            .store(in: &cancellables)

        WebSocketService.shared.groupMemberUpdate
            .receive(on: DispatchQueue.main)
            .sink { [weak self] event in
                self?.handleGroupMemberUpdate(event)
            }
            .store(in: &cancellables)
    }

    private func handleGroupUpdate(_ event: GroupUpdateEvent) {
        if let index = groups.firstIndex(where: { $0.id == event.groupId }) {
            groups[index].name = event.groupName
            groups[index].updatedAt = event.timestamp
        }
    }

    private func handleGroupMemberUpdate(_ event: GroupMemberUpdateEvent) {
        if let groupIndex = groups.firstIndex(where: { $0.id == event.groupId }) {
            if event.isJoining {
                // Add member if not already present
                if !groups[groupIndex].members.contains(where: { $0.id == event.memberId }) {
                    let member = GroupMember(
                        id: event.memberId,
                        username: event.username,
                        displayName: event.displayName,
                        joinedAt: event.timestamp
                    )
                    groups[groupIndex].members.append(member)
                }
            } else {
                // Remove member
                groups[groupIndex].members.removeAll { $0.id == event.memberId }
            }
        }
    }
}
