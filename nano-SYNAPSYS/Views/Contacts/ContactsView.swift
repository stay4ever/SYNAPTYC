import SwiftUI

struct ContactsView: View {
    @EnvironmentObject var viewModel: ContactsViewModel
    @State private var searchText = ""
    @State private var showAddContactSheet = false

    var filteredContacts: [Contact] {
        if searchText.isEmpty {
            return viewModel.contacts
        }
        return viewModel.contacts.filter { contact in
            contact.displayName.localizedCaseInsensitiveContains(searchText) ||
            contact.username.localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        ZStack {
            Color(red: 0.0, green: 0.055, blue: 0.0)
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Header
                VStack(spacing: 12) {
                    HStack {
                        Text("CONTACTS")
                            .font(.system(size: 24, weight: .bold, design: .monospaced))
                            .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255))

                        Spacer()

                        Button(action: { showAddContactSheet = true }) {
                            Image(systemName: "plus.circle.fill")
                                .font(.system(size: 20, weight: .semibold))
                                .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255))
                        }
                    }

                    // Search bar
                    HStack(spacing: 8) {
                        Image(systemName: "magnifyingglass")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.5))

                        TextField("SEARCH CONTACTS", text: $searchText)
                            .font(.system(.body, design: .monospaced))
                            .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255))

                        if !searchText.isEmpty {
                            Button(action: { searchText = "" }) {
                                Image(systemName: "xmark.circle.fill")
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.6))
                            }
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .background(Color(red: 0.04, green: 0.1, blue: 0.04))
                    .border(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.3), width: 1)
                    .cornerRadius(4)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .borderBottom(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.1), width: 1)

                // Contacts list
                if filteredContacts.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "person.crop.circle.dashed")
                            .font(.system(size: 48, weight: .light))
                            .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.3))

                        Text("NO CONTACTS")
                            .font(.system(size: 14, weight: .bold, design: .monospaced))
                            .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.5))

                        Text("Add contacts to start messaging")
                            .font(.system(size: 12, weight: .regular, design: .monospaced))
                            .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.3))
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .padding(.top, 60)
                } else {
                    List {
                        ForEach(filteredContacts) { contact in
                            ContactRow(contact: contact)
                                .listRowBackground(Color.clear)
                                .listRowInsets(EdgeInsets(top: 4, leading: 12, bottom: 4, trailing: 12))
                        }
                    }
                    .listStyle(.plain)
                    .background(Color.clear)
                    .scrollContentBackground(.hidden)
                }

                Spacer()
            }
        }
        .sheet(isPresented: $showAddContactSheet) {
            AddContactSheet(isPresented: $showAddContactSheet)
                .environmentObject(viewModel)
        }
        .onAppear {
            viewModel.loadContacts()
        }
    }
}

#Preview {
    NavigationStack {
        ContactsView()
            .environmentObject(ContactsViewModel())
    }
}
