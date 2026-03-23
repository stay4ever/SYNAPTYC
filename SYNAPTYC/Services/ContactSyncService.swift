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

        var hashSet: Set<String> = []
        try? store.enumerateContacts(with: request) { contact, _ in
            for number in contact.phoneNumbers {
                let raw = number.value.stringValue
                for variant in Self.normalizedVariants(from: raw) {
                    hashSet.insert(Self.sha256hex(variant))
                }
            }
        }
        return Array(hashSet)
    }

    // MARK: - Normalization

    /// Generates all plausible digit-only variants of a phone number to maximise
    /// hash matching across different contact storage formats (e.g. +61 vs 0 for AU).
    static func normalizedVariants(from rawNumber: String) -> [String] {
        let digits = rawNumber
            .components(separatedBy: CharacterSet.decimalDigits.inverted)
            .joined()
        guard digits.count >= 7 else { return [] }

        var variants: Set<String> = [digits]

        // Australian: 0XXXXXXXXX (10d) ↔ 61XXXXXXXXX (11d)
        if digits.hasPrefix("0") && digits.count == 10 {
            variants.insert("61" + digits.dropFirst())
        }
        if digits.hasPrefix("61") && digits.count == 11 {
            variants.insert("0" + digits.dropFirst(2))
        }

        // US / Canada: XXXXXXXXXX (10d) ↔ 1XXXXXXXXXX (11d)
        if digits.count == 10 && !digits.hasPrefix("0") {
            variants.insert("1" + digits)
        }
        if digits.hasPrefix("1") && digits.count == 11 {
            variants.insert(String(digits.dropFirst()))
        }

        // UK: 0XXXXXXXXXX (11d) ↔ 44XXXXXXXXXX (12d)
        if digits.hasPrefix("0") && digits.count == 11 {
            variants.insert("44" + digits.dropFirst())
        }
        if digits.hasPrefix("44") && digits.count == 12 {
            variants.insert("0" + digits.dropFirst(2))
        }

        // India: XXXXXXXXXX (10d) ↔ 91XXXXXXXXXX (12d)
        if digits.count == 10 && !digits.hasPrefix("0") && !digits.hasPrefix("1") {
            variants.insert("91" + digits)
        }
        if digits.hasPrefix("91") && digits.count == 12 {
            variants.insert(String(digits.dropFirst(2)))
        }

        // New Zealand: 0XXXXXXXX (9d) ↔ 64XXXXXXXX (11d)
        if digits.hasPrefix("0") && digits.count == 9 {
            variants.insert("64" + digits.dropFirst())
        }
        if digits.hasPrefix("64") && digits.count == 11 {
            variants.insert("0" + digits.dropFirst(2))
        }

        return Array(variants)
    }

    // MARK: - Hash helpers

    /// Hashes a string of digits with SHA-256 and returns the hex string.
    static func sha256hex(_ digits: String) -> String {
        let hash = SHA256.hash(data: Data(digits.utf8))
        return hash.compactMap { String(format: "%02x", $0) }.joined()
    }

    /// Returns all SHA-256 hash variants for a phone number string (for registration).
    /// Use the first element as the primary hash; send all for contact sync.
    static func hashVariants(phoneNumber: String) -> [String] {
        return normalizedVariants(from: phoneNumber).map { sha256hex($0) }
    }

    /// Single canonical hash for registration (E.164 canonical form preferred).
    /// Tries to produce the longest/most international form first.
    static func hash(phoneNumber: String) -> String {
        let variants = normalizedVariants(from: phoneNumber)
        // Prefer the longest (most likely to be E.164 full form)
        let canonical = variants.max(by: { $0.count < $1.count }) ?? phoneNumber
        return sha256hex(canonical)
    }
}
