import SwiftUI
import UIKit
import Contacts

private struct PhoneContact: Identifiable {
    let id = UUID()
    let name: String
    let phone: String
    /// Non-nil when this device contact is matched to a SYNAPTYC user
    var matchedUser: AppUser? = nil
}

struct ContactsView: View {
    @StateObject private var vm = ContactsViewModel()
    @StateObject private var syncService = ContactSyncService.shared
    @State private var searchText = ""
    // Tab 0 = All Users, Tab 1 = Requests, Tab 2 = Phone Contacts
    @State private var selectedTab = 0
    @State private var phoneContacts: [PhoneContact] = []
    @State private var inviteContact: PhoneContact?

    var filteredUsers: [AppUser] {
        let me = AuthViewModel.shared.currentUser?.id ?? 0
        let list = vm.allUsers.filter { $0.id != me }
        if searchText.isEmpty { return list }
        return list.filter {
            $0.name.localizedCaseInsensitiveContains(searchText) ||
            $0.username.localizedCaseInsensitiveContains(searchText)
        }
    }

    // Online users first, then alphabetical within each group
    var sortedUsers: [AppUser] {
        filteredUsers.sorted {
            if ($0.isOnline ?? false) != ($1.isOnline ?? false) {
                return ($0.isOnline ?? false)
            }
            return $0.name < $1.name
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.deepBlack.ignoresSafeArea()
                ScanlineOverlay()

                VStack(spacing: 0) {
                    // Tab picker
                    Picker("", selection: $selectedTab) {
                        Text("All Users").tag(0)
                        Text("Requests \(vm.pendingIncoming.isEmpty ? "" : "(\(vm.pendingIncoming.count))")").tag(1)
                        Text("Phone").tag(2)
                    }
                    .pickerStyle(.segmented)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .tint(.neonGreen)

                    // Search bar (always visible on All Users tab)
                    if selectedTab == 0 {
                        HStack(spacing: 10) {
                            Image(systemName: "magnifyingglass")
                                .foregroundColor(.matrixGreen).font(.system(size: 13))
                            TextField("Search users…", text: $searchText)
                                .font(.monoBody).foregroundColor(.neonGreen).tint(.neonGreen)
                                .autocorrectionDisabled().textInputAutocapitalization(.never)
                            if !searchText.isEmpty {
                                Button { searchText = "" } label: {
                                    Image(systemName: "xmark.circle.fill")
                                        .foregroundColor(.matrixGreen.opacity(0.6))
                                }
                            }
                        }
                        .padding(10)
                        .background(Color.darkGreen.opacity(0.3))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .padding(.horizontal, 16)
                        .padding(.bottom, 4)
                    }

                    if let success = vm.successMessage {
                        Text("✓ \(success)")
                            .font(.monoCaption).foregroundColor(.neonGreen)
                            .padding(.horizontal, 16).padding(.vertical, 4)
                    }
                    if let err = vm.errorMessage {
                        Text("⚠ \(err)")
                            .font(.monoCaption).foregroundColor(.alertRed)
                            .padding(.horizontal, 16).padding(.vertical, 4)
                    }

                    if vm.isLoading && vm.allUsers.isEmpty {
                        Spacer()
                        ProgressView().tint(.neonGreen)
                        Spacer()
                    } else {
                        ScrollView {
                            LazyVStack(spacing: 0) {
                                switch selectedTab {
                                case 0:
                                    if sortedUsers.isEmpty {
                                        emptyState(icon: "person.2", text: "No users found.")
                                    } else {
                                        ForEach(sortedUsers) { user in
                                            let status: ContactRowStatus = vm.isContact(user.id) ? .accepted
                                                : vm.hasPendingRequest(to: user.id) ? .pendingOutgoing : .none
                                            ContactRow(user: user, status: status) { action in
                                                if action == .sendRequest {
                                                    Task { await vm.sendRequest(to: user) }
                                                }
                                            }
                                            Divider().background(Color.neonGreen.opacity(0.07))
                                        }
                                    }
                                case 1:
                                    if vm.pendingIncoming.isEmpty && vm.pendingOutgoing.isEmpty {
                                        emptyState(icon: "tray", text: "No pending requests.")
                                    } else {
                                        ForEach(vm.pendingIncoming) { contact in
                                            if let user = contact.otherUser {
                                                ContactRow(user: user, status: .pendingIncoming) { action in
                                                    Task {
                                                        if action == .accept {
                                                            await vm.accept(contact: contact)
                                                        } else {
                                                            await vm.reject(contact: contact)
                                                        }
                                                    }
                                                }
                                                Divider().background(Color.neonGreen.opacity(0.07))
                                            }
                                        }
                                        ForEach(vm.pendingOutgoing) { contact in
                                            if let user = contact.otherUser {
                                                ContactRow(user: user, status: .pendingOutgoing) { _ in }
                                                Divider().background(Color.neonGreen.opacity(0.07))
                                            }
                                        }
                                    }
                                default:
                                    phoneContactsContent
                                }
                            }
                        }
                        .refreshable { await vm.load() }
                    }
                }
            }
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Text("CONTACTS").font(.monoHeadline).foregroundColor(.neonGreen).glowText()
                }
            }
        }
        .task { await vm.load() }
        .onChange(of: selectedTab) { _, tab in
            if tab == 2 { Task { await loadPhoneContacts() } }
        }
        .sheet(item: $inviteContact) { contact in
            InviteShareSheet(items: ["Hey! Join me on SYNAPTYC — a private, encrypted messenger. Download it and find me. 🔐"])
        }
    }

    // MARK: - Phone Contacts Tab

    @ViewBuilder
    private var phoneContactsContent: some View {
        switch syncService.syncStatus {
        case .denied:
            VStack(spacing: 16) {
                Image(systemName: "lock.slash").font(.system(size: 36)).foregroundColor(.matrixGreen.opacity(0.4))
                Text("Contacts access denied.\nEnable in iOS Settings → Privacy → Contacts.")
                    .font(.monoCaption).foregroundColor(.matrixGreen.opacity(0.6))
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity).padding(.top, 60)

        case .requesting, .syncing:
            VStack(spacing: 12) {
                ProgressView().tint(.neonGreen)
                Text("Syncing contacts…").font(.monoCaption).foregroundColor(.matrixGreen)
            }
            .frame(maxWidth: .infinity).padding(.top, 60)

        default:
            if phoneContacts.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: "person.crop.circle.badge.questionmark")
                        .font(.system(size: 36)).foregroundColor(.matrixGreen.opacity(0.4))
                    Text("No phone contacts synced yet.")
                        .font(.monoCaption).foregroundColor(.matrixGreen.opacity(0.6))
                    Button {
                        Task { await loadPhoneContacts() }
                    } label: {
                        Text("Sync Contacts")
                            .font(.monoBody).foregroundColor(.neonGreen)
                            .padding(.horizontal, 20).padding(.vertical, 10)
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.neonGreen.opacity(0.5)))
                    }
                }
                .frame(maxWidth: .infinity).padding(.top, 60)
            } else {
                // Single unified list — matched contacts float to the top,
                // each showing a green SYNAPTYC badge so the user can see at a glance
                // who already has the app installed.
                let sorted = phoneContacts.sorted {
                    if ($0.matchedUser != nil) != ($1.matchedUser != nil) { return $0.matchedUser != nil }
                    return $0.name < $1.name
                }
                ForEach(sorted) { contact in
                    phoneContactRow(contact)
                    Divider().background(Color.neonGreen.opacity(0.07))
                }
            }
        }
    }

    @ViewBuilder
    private func phoneContactRow(_ contact: PhoneContact) -> some View {
        HStack(spacing: 12) {
            // Avatar with green SYNAPTYC badge if on the app
            ZStack(alignment: .bottomTrailing) {
                Circle()
                    .fill(contact.matchedUser != nil ? Color.darkGreen : Color.darkGreen.opacity(0.45))
                    .frame(width: 42, height: 42)
                    .overlay(Circle().stroke(
                        contact.matchedUser != nil ? Color.neonGreen.opacity(0.6) : Color.gray.opacity(0.2),
                        lineWidth: contact.matchedUser != nil ? 2 : 1
                    ))
                Text(String(contact.name.prefix(1)).uppercased())
                    .font(.system(size: 15, weight: .bold, design: .monospaced))
                    .foregroundColor(contact.matchedUser != nil ? .neonGreen : .matrixGreen.opacity(0.5))

                // Green SYNAPTYC indicator badge
                if contact.matchedUser != nil {
                    Image(systemName: "checkmark.seal.fill")
                        .font(.system(size: 13))
                        .foregroundColor(.neonGreen)
                        .background(Circle().fill(Color.deepBlack).padding(-2))
                        .offset(x: 3, y: 3)
                }
            }

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(contact.name)
                        .font(.monoBody)
                        .foregroundColor(contact.matchedUser != nil ? .neonGreen : .matrixGreen.opacity(0.7))
                }
                if let user = contact.matchedUser {
                    Text("@\(user.username) · on SYNAPTYC")
                        .font(.monoCaption)
                        .foregroundColor(.neonGreen.opacity(0.55))
                } else {
                    Text(contact.phone)
                        .font(.monoCaption)
                        .foregroundColor(.matrixGreen.opacity(0.5))
                }
            }

            Spacer()

            // Action
            if let user = contact.matchedUser {
                let status: ContactRowStatus = vm.isContact(user.id) ? .accepted
                    : vm.hasPendingRequest(to: user.id) ? .pendingOutgoing : .none
                switch status {
                case .accepted:
                    Image(systemName: "checkmark.shield.fill")
                        .foregroundColor(.neonGreen.opacity(0.6))
                case .pendingOutgoing:
                    Text("Pending")
                        .font(.monoCaption).foregroundColor(.matrixGreen)
                default:
                    Button { Task { await vm.sendRequest(to: user) } } label: {
                        Image(systemName: "person.badge.plus")
                            .font(.system(size: 16)).foregroundColor(.neonGreen)
                    }
                }
            } else {
                Button { inviteContact = contact } label: {
                    Text("Invite")
                        .font(.monoCaption).foregroundColor(.matrixGreen)
                        .padding(.horizontal, 12).padding(.vertical, 6)
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.matrixGreen.opacity(0.35)))
                }
            }
        }
        .padding(.horizontal, 16).padding(.vertical, 10)
    }

    private func loadPhoneContacts() async {
        let status = CNContactStore.authorizationStatus(for: .contacts)
        guard status == .authorized || status == .notDetermined else { return }

        // Sync first — populates syncService.matchedUsers
        await syncService.syncIfAuthorized()

        // Build name → AppUser lookup for correlation (case-insensitive)
        let matchedByName: [String: AppUser] = Dictionary(
            syncService.matchedUsers.map { ($0.name.lowercased().trimmingCharacters(in: .whitespaces), $0) },
            uniquingKeysWith: { first, _ in first }
        )

        // Enumerate device contacts off the main thread (blocking I/O)
        let raw = await Task.detached(priority: .userInitiated) {
            let keys: [CNKeyDescriptor] = [
                CNContactGivenNameKey as CNKeyDescriptor,
                CNContactFamilyNameKey as CNKeyDescriptor,
                CNContactPhoneNumbersKey as CNKeyDescriptor
            ]
            let request = CNContactFetchRequest(keysToFetch: keys)
            var contacts: [PhoneContact] = []
            try? CNContactStore().enumerateContacts(with: request) { contact, _ in
                guard let number = contact.phoneNumbers.first?.value.stringValue,
                      !number.isEmpty else { return }
                let name = [contact.givenName, contact.familyName]
                    .filter { !$0.isEmpty }.joined(separator: " ")
                guard !name.isEmpty else { return }
                contacts.append(PhoneContact(name: name, phone: number))
            }
            return contacts
        }.value

        // Tag each contact with their matched AppUser (back on main actor)
        phoneContacts = raw.map { contact in
            var c = contact
            c.matchedUser = matchedByName[contact.name.lowercased().trimmingCharacters(in: .whitespaces)]
            return c
        }
    }

    private func emptyState(icon: String, text: String) -> some View {
        VStack(spacing: 14) {
            Image(systemName: icon).font(.system(size: 36)).foregroundColor(.matrixGreen.opacity(0.4))
            Text(text).font(.monoCaption).foregroundColor(.matrixGreen.opacity(0.6))
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 60)
    }
}

// MARK: - Share Sheet

private struct InviteShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
