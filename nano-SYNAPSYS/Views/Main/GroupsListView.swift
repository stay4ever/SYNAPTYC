import SwiftUI

struct GroupsListView: View {
    @EnvironmentObject var viewModel: GroupsViewModel
    @State private var searchText = ""
    @State private var showCreateGroupSheet = false

    var filteredGroups: [Group] {
        if searchText.isEmpty {
            return viewModel.groups
        }
        return viewModel.groups.filter { group in
            group.name.localizedCaseInsensitiveContains(searchText)
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
                        Text("GROUPS")
                            .font(.system(size: 24, weight: .bold, design: .monospaced))
                            .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255))

                        Spacer()

                        Button(action: { showCreateGroupSheet = true }) {
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

                        TextField("SEARCH GROUPS", text: $searchText)
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
                    .border(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.3))} 
                    .cornerRadius(4)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .overlay(alignment: .bottom) { Divider().background(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.1))} 

                // Groups list
                if filteredGroups.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "person.2.dashed")
                            .font(.system(size: 48, weight: .light))
                            .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.3))

                        Text("NO GROUPS")
                            .font(.system(size: 14, weight: .bold, design: .monospaced))
                            .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.5))

                        Text("Create a group to collaborate with multiple contacts")
                            .font(.system(size: 12, weight: .regular, design: .monospaced))
                            .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.3))
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 20)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .padding(.top, 60)
                } else {
                    List {
                        ForEach(filteredGroups) { group in
                            NavigationLink(destination: GroupChatView(group: group)) {
                                GroupRow(group: group)
                            }
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
        .sheet(isPresented: $showCreateGroupSheet) {
            CreateGroupSheet(isPresented: $showCreateGroupSheet)
                .environmentObject(viewModel)
        }
        .onAppear {
            viewModel.loadGroups()
        }
    }
}

struct GroupRow: View {
    let group: Group

    var body: some View {
        HStack(spacing: 12) {
            // Avatar
            ZStack {
                Circle()
                    .fill(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.1))
                    .border(Color(red: 0.0, green: 1.0, blue: 0.255))} 

                Image(systemName: "person.2.fill")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255))
            }
            .frame(width: 44, height: 44)

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(group.name)
                        .font(.system(.body, weight: .semibold, design: .monospaced))
                        .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255))

                    Spacer()

                    Text(group.lastMessageTime)
                        .font(.system(size: 11, weight: .regular, design: .monospaced))
                        .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.5))
                }

                HStack(spacing: 8) {
                    Text("\(group.memberCount) MEMBERS")
                        .font(.system(size: 12, weight: .regular, design: .monospaced))
                        .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.6))

                    Divider()
                        .frame(height: 4)
                        .background(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.3))

                    Text(group.lastMessage)
                        .font(.system(.caption, design: .monospaced))
                        .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.5))
                        .lineLimit(1)
                }
            }

            Spacer()
        }
        .padding(.vertical, 8)
        .contentShape(Rectangle())
    }
}

struct CreateGroupSheet: View {
    @Binding var isPresented: Bool
    @EnvironmentObject var viewModel: GroupsViewModel
    @State private var groupName = ""
    @State private var selectedMembers: Set<String> = []

    var body: some View {
        NavigationStack {
            ZStack {
                Color(red: 0.0, green: 0.055, blue: 0.0)
                    .ignoresSafeArea()

                VStack(spacing: 16) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("GROUP NAME")
                            .font(.system(size: 12, weight: .bold, design: .monospaced))
                            .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.6))

                        NeonTextField(
                            placeholder: "ENTER GROUP NAME",
                            text: $groupName,
                            isSecure: false
                        )
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 16)

                    Spacer()

                    HStack(spacing: 12) {
                        Button(action: { isPresented = false }) {
                            Text("CANCEL")
                                .font(.system(.body, weight: .semibold, design: .monospaced))
                                .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .border(Color(red: 0.0, green: 1.0, blue: 0.255))} 
                                .cornerRadius(4)
                        }

                        Button(action: {
                            viewModel.createGroup(name: groupName)
                            isPresented = false
                        }) {
                            Text("CREATE")
                                .font(.system(.body, weight: .semibold, design: .monospaced))
                                .foregroundColor(Color(red: 0.0, green: 0.055, blue: 0.0))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .background(Color(red: 0.0, green: 1.0, blue: 0.255))
                                .cornerRadius(4)
                        }
                        .disabled(groupName.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 20)
                }
            }
            .navigationTitle("CREATE GROUP")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

#Preview {
    NavigationStack {
        GroupsListView()
            .environmentObject(GroupsViewModel())
    }
}
