import Foundation

@MainActor
final class ContactsViewModel: ObservableObject {
    @Published var contacts: [Contact]        = []
    @Published var allUsers: [AppUser]        = []
    @Published var isLoading                  = false
    @Published var errorMessage: String?
    @Published var successMessage: String?

    var acceptedContacts: [Contact] { contacts.filter { $0.status == .accepted } }
    var pendingIncoming: [Contact] {
        let me = AuthViewModel.shared.currentUser?.id ?? 0
        return contacts.filter { $0.status == .pending && $0.receiverId == me }
    }
    var pendingOutgoing: [Contact] {
        let me = AuthViewModel.shared.currentUser?.id ?? 0
        return contacts.filter { $0.status == .pending && $0.requesterId == me }
    }

    func load() async {
        isLoading = true; defer { isLoading = false }
        do {
            async let c = APIService.shared.contacts()
            async let u = APIService.shared.users()
            let (fetched, users) = try await (c, u)
            contacts = fetched
            allUsers = users
            // Attach other user object to each contact
            let me = AuthViewModel.shared.currentUser?.id ?? 0
            contacts = contacts.map { contact in
                var c = contact
                let otherId = contact.requesterId == me ? contact.receiverId : contact.requesterId
                c.otherUser = users.first { $0.id == otherId }
                return c
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func sendRequest(to user: AppUser) async {
        do {
            let contact = try await APIService.shared.sendContactRequest(to: user.id)
            contacts.append(contact)
            successMessage = "Request sent to \(user.name)"
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func accept(contact: Contact) async {
        do {
            let updated = try await APIService.shared.updateContact(id: contact.id, status: "accepted")
            replace(updated)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func reject(contact: Contact) async {
        do {
            let updated = try await APIService.shared.updateContact(id: contact.id, status: "rejected")
            contacts.removeAll { $0.id == updated.id }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func block(contact: Contact) async {
        do {
            let updated = try await APIService.shared.updateContact(id: contact.id, status: "blocked")
            replace(updated)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func isContact(_ userId: Int) -> Bool {
        contacts.contains { c in
            c.status == .accepted &&
            (c.requesterId == userId || c.receiverId == userId)
        }
    }

    func hasPendingRequest(to userId: Int) -> Bool {
        contacts.contains { c in
            c.status == .pending &&
            (c.requesterId == userId || c.receiverId == userId)
        }
    }

    private func replace(_ contact: Contact) {
        if let idx = contacts.firstIndex(where: { $0.id == contact.id }) {
            contacts[idx] = contact
        }
    }
}
