import Foundation
import Combine

@MainActor
class ContactsViewModel: ObservableObject {
    @Published var contacts: [Contact] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var searchText = ""

    private var cancellables = Set<AnyCancellable>()

    init() {
        subscribeToWebSocket()
    }

    // MARK: - Computed Properties

    var filteredContacts: [Contact] {
        if searchText.isEmpty {
            return contacts
        }
        return contacts.filter { contact in
            contact.displayName.localizedCaseInsensitiveContains(searchText) ||
            contact.username.localizedCaseInsensitiveContains(searchText)
        }
    }

    // MARK: - Load Contacts

    func loadContacts() async {
        isLoading = true
        errorMessage = nil

        do {
            let allContacts = try await APIService.shared.getContacts()
            self.contacts = allContacts.sorted { $0.displayName < $1.displayName }
            isLoading = false
        } catch {
            errorMessage = "Failed to load contacts: \(error.localizedDescription)"
            isLoading = false
        }
    }

    // MARK: - Add Contact

    func addContact(username: String) async {
        errorMessage = nil

        do {
            let newContact = try await APIService.shared.addContact(username: username)
            if !contacts.contains(where: { $0.id == newContact.id }) {
                contacts.append(newContact)
                contacts.sort { $0.displayName < $1.displayName }
            }
        } catch {
            errorMessage = "Failed to add contact: \(error.localizedDescription)"
        }
    }

    // MARK: - Remove Contact

    func removeContact(id: String) async {
        errorMessage = nil

        do {
            try await APIService.shared.removeContact(id: id)
            contacts.removeAll { $0.id == id }
        } catch {
            errorMessage = "Failed to remove contact: \(error.localizedDescription)"
        }
    }

    // MARK: - WebSocket Subscription

    private func subscribeToWebSocket() {
        WebSocketService.shared.presenceUpdate
            .receive(on: DispatchQueue.main)
            .sink { [weak self] event in
                self?.handlePresenceUpdate(event)
            }
            .store(in: &cancellables)
    }

    private func handlePresenceUpdate(_ event: PresenceEvent) {
        if let index = contacts.firstIndex(where: { $0.id == event.userId }) {
            contacts[index].isOnline = event.isOnline
            contacts[index].lastSeenAt = event.timestamp
        }
    }
}
