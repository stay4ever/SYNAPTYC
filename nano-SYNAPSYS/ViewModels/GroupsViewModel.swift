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

    func loadGroups() {
        Task {
            isLoading = true
            errorMessage = nil
            do {
                let allGroups = try await APIService.shared.getGroups()
                self.groups = allGroups.sorted { $0.name < $1.name }
            } catch {
                errorMessage = "Failed to load groups: \(error.localizedDescription)"
            }
            isLoading = false
        }
    }

    func createGroup(name: String, memberIds: [String] = []) {
        Task {
            errorMessage = nil
            do {
                let newGroup = try await APIService.shared.createGroup(name: name, memberIds: memberIds)
                groups.append(newGroup)
                groups.sort { $0.name < $1.name }
            } catch {
                errorMessage = "Failed to create group: \(error.localizedDescription)"
            }
        }
    }

    func leaveGroup(id: String) {
        Task {
            do {
                try await APIService.shared.leaveGroup(id: id)
                groups.removeAll { $0.id == id }
            } catch {
                errorMessage = "Failed to leave group: \(error.localizedDescription)"
            }
        }
    }

    func deleteGroup(id: String) {
        Task {
            do {
                try await APIService.shared.deleteGroup(id: id)
                groups.removeAll { $0.id == id }
            } catch {
                errorMessage = "Failed to delete group: \(error.localizedDescription)"
            }
        }
    }

    private func subscribeToWebSocket() {
        WebSocketService.shared.groupUpdate
            .receive(on: DispatchQueue.main)
            .sink { [weak self] event in
                if let index = self?.groups.firstIndex(where: { $0.id == event.groupId }) {
                    self?.groups[index].name = event.groupName
                    self?.groups[index].updatedAt = event.timestamp
                }
            }
            .store(in: &cancellables)

        WebSocketService.shared.groupMemberUpdate
            .receive(on: DispatchQueue.main)
            .sink { [weak self] event in
                if let groupIndex = self?.groups.firstIndex(where: { $0.id == event.groupId }) {
                    if event.isJoining {
                        let member = GroupMember(id: event.memberId, username: event.username,
                                                displayName: event.displayName, joinedAt: event.timestamp)
                        self?.groups[groupIndex].members.append(member)
                    } else {
                        self?.groups[groupIndex].members.removeAll { $0.id == event.memberId }
                    }
                }
            }
            .store(in: &cancellables)
    }
}
