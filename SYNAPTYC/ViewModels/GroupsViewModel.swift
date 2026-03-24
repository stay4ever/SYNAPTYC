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
        // Only reload groups when we receive a structural group event (GKEX = key distribution,
        // not a chat message). Regular chat messages do NOT need a full groups reload.
        WebSocketService.shared.$incomingGroupMessage
            .compactMap { $0 }
            .filter { $0.content.hasPrefix("GKEX:") }
            .debounce(for: .seconds(1), scheduler: RunLoop.main)
            .sink { [weak self] _ in Task { await self?.load() } }
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

    func createGroup(name: String, description: String, avatarData: Data? = nil) async throws -> Group {
        var g = try await APIService.shared.createGroup(name: name, description: description)
        if let data = avatarData,
           let updated = try? await APIService.shared.uploadGroupAvatar(groupId: g.id, jpegData: data) {
            g = updated
        }
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
