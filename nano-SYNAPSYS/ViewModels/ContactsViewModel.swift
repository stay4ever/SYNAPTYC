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

    var filteredContacts: [Contact] {
        if searchText.isEmpty { return contacts }
        return contacts.filter { contact in
            contact.displayName.localizedCaseInsensitiveContains(searchText) ||
            contact.username.localizedCaseInsensitiveContains(searchText)
        }
    }

    func loadContacts() {
        Task {
            isLoading = true
            errorMessage = nil
            do {
                let allContacts = try await APIService.shared.getContacts()
                self.contacts = allContacts.sorted { $0.displayName < $1.displayName }
            } catch {
                errorMessage = "Failed to load contacts: \(error.localizedDescription)"
            }
            isLoading = false
        }
    }

    func addContact(username: String) {
        Task {
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
    }

    func removeContact(id: String) {
        Task {
            errorMessage = nil
            do {
                try await APIService.shared.removeContact(contactId: id)
                contacts.removeAll { $0.id == id }
            } catch {
                errorMessage = "Failed to remove contact: \(error.localizedDescription)"
            }
        }
    }

    private func subscribeToWebSocket() {
        WebSocketService.shared.presencePublisher
            .receive(on: DispatchQueue.main)
            .sink { [weak self] event in
                if let index = self?.contacts.firstIndex(where: { $0.contactId == event.userId }) {
                    self?.contacts[index].isOnline = event.isOnline
                }
            }
            .store(in: &cancellables)
    }
}
