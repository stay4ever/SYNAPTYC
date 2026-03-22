import SwiftUI

struct ContactsView: View {
    @StateObject private var vm = ContactsViewModel()
    @State private var searchText = ""
    @State private var selectedTab = 0

    var filteredUsers: [AppUser] {
        let me = AuthViewModel.shared.currentUser?.id ?? 0
        let list = vm.allUsers.filter { $0.id != me }
        if searchText.isEmpty { return list }
        return list.filter {
            $0.name.localizedCaseInsensitiveContains(searchText) ||
            $0.username.localizedCaseInsensitiveContains(searchText)
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
                        Text("Contacts").tag(0)
                        Text("Requests \(vm.pendingIncoming.isEmpty ? "" : "(\(vm.pendingIncoming.count))")").tag(1)
                        Text("All Users").tag(2)
                    }
                    .pickerStyle(.segmented)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .tint(.neonGreen)

                    if selectedTab == 2 {
                        HStack(spacing: 10) {
                            Image(systemName: "magnifyingglass")
                                .foregroundColor(.matrixGreen).font(.system(size: 13))
                            TextField("Search users…", text: $searchText)
                                .font(.monoBody).foregroundColor(.neonGreen).tint(.neonGreen)
                                .autocorrectionDisabled().textInputAutocapitalization(.never)
                        }
                        .padding(10)
                        .background(Color.darkGreen.opacity(0.3))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .padding(.horizontal, 16)
                        .padding(.bottom, 8)
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

                    ScrollView {
                        LazyVStack(spacing: 0) {
                            switch selectedTab {
                            case 0:
                                if vm.acceptedContacts.isEmpty {
                                    emptyState(icon: "person.2", text: "No contacts yet.\nSearch All Users to add someone.")
                                } else {
                                    ForEach(vm.acceptedContacts) { contact in
                                        if let user = contact.otherUser {
                                            ContactRow(user: user, status: .accepted) { _ in }
                                            Divider().background(Color.neonGreen.opacity(0.07))
                                        }
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
                                ForEach(filteredUsers) { user in
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
                        }
                    }
                    .refreshable { await vm.load() }
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
