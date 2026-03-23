import Foundation
import Contacts
import CryptoKit

/// Syncs device contacts with SYNAPTYC users — Signal-style phone number discovery.
/// Only SHA-256 hashes of phone numbers are ever sent to the server; raw numbers stay on device.
@MainActor
final class ContactSyncService: ObservableObject {
    static let shared = ContactSyncService()

    @Published var matchedUsers: [AppUser] = []
    @Published var syncStatus: SyncStatus  = .idle

    enum SyncStatus: Equatable {
        case idle, requesting, syncing, done, denied, error(String)
    }

    private init() {}

    // MARK: - Public

    func syncIfAuthorized() async {
        let status = CNContactStore.authorizationStatus(for: .contacts)
        switch status {
        case .authorized:
            await performSync()
        case .notDetermined:
            await requestAndSync()
        case .denied, .restricted, .limited:
            syncStatus = .denied
        @unknown default:
            break
        }
    }

    // MARK: - Private

    private func requestAndSync() async {
        syncStatus = .requesting
        let store = CNContactStore()
        do {
            let granted = try await store.requestAccess(for: .contacts)
            if granted { await performSync() } else { syncStatus = .denied }
        } catch {
            syncStatus = .error(error.localizedDescription)
        }
    }

    private func performSync() async {
        syncStatus = .syncing
        let hashes = fetchContactHashes()
        guard !hashes.isEmpty else { syncStatus = .done; return }
        do {
            let users = try await APIService.shared.syncContacts(hashes: hashes)
            matchedUsers = users
            syncStatus = .done
        } catch {
            syncStatus = .error(error.localizedDescription)
        }
    }

    private func fetchContactHashes() -> [String] {
        let store   = CNContactStore()
        let keys    = [CNContactPhoneNumbersKey as CNKeyDescriptor]
        let request = CNContactFetchRequest(keysToFetch: keys)

        var hashes: [String] = []
        try? store.enumerateContacts(with: request) { contact, _ in
            for number in contact.phoneNumbers {
                let digits = number.value.stringValue
                    .components(separatedBy: CharacterSet.decimalDigits.inverted)
                    .joined()
                guard digits.count >= 7 else { continue }
                // Hash with SHA-256 — server never sees raw numbers
                let data   = Data(digits.utf8)
                let hash   = SHA256.hash(data: data)
                let hex    = hash.compactMap { String(format: "%02x", $0) }.joined()
                hashes.append(hex)
            }
        }
        return Array(Set(hashes)) // deduplicate
    }

    // MARK: - Hash helper (for registration)

    static func hash(phoneNumber: String) -> String {
        let digits = phoneNumber
            .components(separatedBy: CharacterSet.decimalDigits.inverted)
            .joined()
        let data   = Data(digits.utf8)
        let hash   = SHA256.hash(data: data)
        return hash.compactMap { String(format: "%02x", $0) }.joined()
    }
}
