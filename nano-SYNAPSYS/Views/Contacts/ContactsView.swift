import SwiftUI

struct ContactsView: View {
    @EnvironmentObject var viewModel: ContactsViewModel
    @State private var searchText = ""
    @State private var showAddContactSheet = false

    var filteredContacts: [Contact] {
        if searchText.isEmpty { return viewModel.contacts }
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
                    .overlay(RoundedRectangle(cornerRadius: 4).stroke(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.3), lineWidth: 1))
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)

                if filteredContacts.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "person.crop.circle.dashed")
                            .font(.system(size: 48, weight: .light))
                            .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.3))
                        Text("NO CONTACTS")
                            .font(.system(size: 14, weight: .bold, design: .monospaced))
                            .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.5))
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
        .onAppear { viewModel.loadContacts() }
    }
}

struct AddContactSheet: View {
    @Binding var isPresented: Bool
    @EnvironmentObject var viewModel: ContactsViewModel
    @State private var username = ""

    var body: some View {
        NavigationStack {
            ZStack {
                Color(red: 0.0, green: 0.055, blue: 0.0)
                    .ignoresSafeArea()

                VStack(spacing: 16) {
                    NeonTextField(placeholder: "USERNAME", text: $username, isSecure: false)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .padding(.horizontal, 16)
                        .padding(.top, 16)

                    Spacer()

                    HStack(spacing: 12) {
                        Button(action: { isPresented = false }) {
                            Text("CANCEL")
                                .font(.system(size: 17, weight: .semibold, design: .monospaced))
                                .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .overlay(RoundedRectangle(cornerRadius: 4).stroke(Color(red: 0.0, green: 1.0, blue: 0.255), lineWidth: 1))
                        }

                        Button(action: {
                            viewModel.addContact(username: username)
                            isPresented = false
                        }) {
                            Text("ADD")
                                .font(.system(size: 17, weight: .semibold, design: .monospaced))
                                .foregroundColor(Color(red: 0.0, green: 0.055, blue: 0.0))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .background(Color(red: 0.0, green: 1.0, blue: 0.255))
                                .cornerRadius(4)
                        }
                        .disabled(username.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 20)
                }
            }
            .navigationTitle("ADD CONTACT")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

#Preview {
    NavigationStack {
        ContactsView()
            .environmentObject(ContactsViewModel())
    }
}
