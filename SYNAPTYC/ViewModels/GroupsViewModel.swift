import Foundation
import Combine

@MainActor
final class GroupsViewModel: ObservableObject {
    @Published var groups: [Group] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var inviteURL: String?
    @Published var isGeneratingInvite = false

    private var cancellables = Set<AnyCancellable>()

    init() {
        // Refresh groups when notified of a group_invite event
        WebSocketService.shared.$incomingGroupMessage
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in
                Task { await self?.load() }
            }
            .store(in: &cancellables)
    }

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            groups = try await APIService.shared.groups()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func createGroup(name: String, description: String) async throws -> Group {
        let g = try await APIService.shared.createGroup(name: name, description: description)
        groups.insert(g, at: 0)
        return g
    }

    func deleteGroup(_ group: Group) async {
        do {
            try await APIService.shared.deleteGroup(groupId: group.id)
            groups.removeAll { $0.id == group.id }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func generateInvite() async {
        isGeneratingInvite = true
        defer { isGeneratingInvite = false }
        do {
            let resp = try await APIService.shared.createInvite()
            inviteURL = resp.inviteUrl
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
