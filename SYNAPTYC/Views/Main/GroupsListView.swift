import SwiftUI

struct GroupsListView: View {
    @StateObject private var vm = GroupsViewModel()
    @State private var showCreateSheet = false
    @State private var showInviteSheet = false

    var body: some View {
        NavigationStack {
            ZStack {
                Color.deepBlack.ignoresSafeArea()
                ScanlineOverlay()

                VStack(spacing: 0) {
                    if vm.isLoading && vm.groups.isEmpty {
                        Spacer()
                        ProgressView().tint(.neonGreen)
                        Spacer()
                    } else if vm.groups.isEmpty {
                        Spacer()
                        VStack(spacing: 16) {
                            Image(systemName: "person.3.fill")
                                .font(.system(size: 48))
                                .foregroundColor(.matrixGreen.opacity(0.3))
                            Text("No groups yet")
                                .font(.monoHeadline)
                                .foregroundColor(.matrixGreen)
                            Text("Create a group to start chatting\nwith multiple people at once.")
                                .font(.monoCaption)
                                .foregroundColor(.matrixGreen.opacity(0.5))
                                .multilineTextAlignment(.center)
                            NeonButton("+ CREATE GROUP") {
                                showCreateSheet = true
                            }
                            .frame(maxWidth: 220)
                        }
                        .padding(32)
                        Spacer()
                    } else {
                        ScrollView {
                            LazyVStack(spacing: 0) {
                                ForEach(vm.groups) { group in
                                    NavigationLink(destination: GroupChatView(group: group)) {
                                        GroupRow(group: group)
                                    }
                                    .buttonStyle(.plain)
                                    Divider().background(Color.neonGreen.opacity(0.08))
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
                    Text("GROUPS")
                        .font(.monoHeadline)
                        .foregroundColor(.neonGreen)
                        .glowText()
                }
                ToolbarItem(placement: .navigationBarLeading) {
                    Button {
                        showInviteSheet = true
                    } label: {
                        Label("Invite", systemImage: "envelope.fill")
                            .font(.system(size: 14))
                            .foregroundColor(.neonGreen)
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        showCreateSheet = true
                    } label: {
                        Image(systemName: "plus")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(.neonGreen)
                    }
                }
            }
        }
        .sheet(isPresented: $showCreateSheet) {
            CreateGroupSheet { name, desc in
                Task {
                    do {
                        _ = try await vm.createGroup(name: name, description: desc)
                        showCreateSheet = false
                    } catch {
                        vm.errorMessage = error.localizedDescription
                    }
                }
            }
        }
        .sheet(isPresented: $showInviteSheet) {
            InviteSheet(vm: vm)
        }
        .alert("Error", isPresented: Binding(
            get: { vm.errorMessage != nil },
            set: { if !$0 { vm.errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) { vm.errorMessage = nil }
        } message: {
            Text(vm.errorMessage ?? "")
        }
        .task { await vm.load() }
    }
}

// MARK: - Group Row

struct GroupRow: View {
    let group: Group

    var body: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle()
                    .fill(Color.darkGreen)
                    .frame(width: 46, height: 46)
                    .overlay(Circle().stroke(Color.neonGreen.opacity(0.3), lineWidth: 1.5))
                Image(systemName: "person.3.fill")
                    .font(.system(size: 16))
                    .foregroundColor(.neonGreen)
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(group.name)
                    .font(.monoBody).fontWeight(.semibold)
                    .foregroundColor(.neonGreen)
                Text("\(group.members.count) member\(group.members.count != 1 ? "s" : "")")
                    .font(.monoCaption)
                    .foregroundColor(.matrixGreen)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.system(size: 12))
                .foregroundColor(.matrixGreen.opacity(0.4))
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .contentShape(Rectangle())
    }
}

// MARK: - Create Group Sheet

struct CreateGroupSheet: View {
    var onConfirm: (String, String) -> Void
    @Environment(\.dismiss) var dismiss
    @State private var name = ""
    @State private var desc = ""

    var body: some View {
        ZStack {
            Color.deepBlack.ignoresSafeArea()
            VStack(spacing: 20) {
                Text("CREATE GROUP")
                    .font(.monoHeadline)
                    .foregroundColor(.neonGreen)
                    .glowText()
                    .padding(.top, 8)

                NeonTextField(placeholder: "Group name", text: $name, icon: "person.3")

                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Image(systemName: "text.alignleft")
                            .foregroundColor(.matrixGreen)
                        Text("DESCRIPTION (optional)")
                            .font(.monoSmall)
                            .foregroundColor(.matrixGreen)
                    }
                    TextEditor(text: $desc)
                        .font(.monoBody)
                        .foregroundColor(.neonGreen)
                        .tint(.neonGreen)
                        .frame(height: 80)
                        .padding(10)
                        .background(Color.darkGreen.opacity(0.4))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(Color.neonGreen.opacity(0.2), lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .scrollContentBackground(.hidden)
                }
                .padding(.horizontal, 16)

                NeonButton("CREATE", icon: "person.3.fill") {
                    guard !name.trimmingCharacters(in: .whitespaces).isEmpty else { return }
                    onConfirm(name.trimmingCharacters(in: .whitespaces), desc.trimmingCharacters(in: .whitespaces))
                }
                .padding(.horizontal, 16)
                .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)

                NeonButton("CANCEL", style: .secondary) { dismiss() }
                    .padding(.horizontal, 16)
            }
        }
        .presentationDetents([.medium])
    }
}

// MARK: - Invite Sheet

struct InviteSheet: View {
    @ObservedObject var vm: GroupsViewModel
    @Environment(\.dismiss) var dismiss
    @State private var copied = false
    @State private var showShareSheet = false

    var body: some View {
        ZStack {
            Color.deepBlack.ignoresSafeArea()
            VStack(spacing: 20) {
                Text("INVITE SOMEONE")
                    .font(.monoHeadline)
                    .foregroundColor(.neonGreen)
                    .glowText()
                    .padding(.top, 8)

                Text("Generate a one-time invite link.\nExpires in 7 days.")
                    .font(.monoCaption)
                    .foregroundColor(.matrixGreen)
                    .multilineTextAlignment(.center)

                if let url = vm.inviteURL {
                    VStack(spacing: 12) {
                        Text(url)
                            .font(.system(size: 10, design: .monospaced))
                            .foregroundColor(.neonGreen.opacity(0.8))
                            .padding(12)
                            .frame(maxWidth: .infinity)
                            .background(Color.darkGreen.opacity(0.4))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(Color.neonGreen.opacity(0.2), lineWidth: 1)
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .padding(.horizontal, 16)

                        HStack(spacing: 12) {
                            NeonButton(copied ? "✓ COPIED" : "COPY LINK", icon: "doc.on.doc") {
                                UIPasteboard.general.string = url
                                copied = true
                                DispatchQueue.main.asyncAfter(deadline: .now() + 2) { copied = false }
                            }
                            NeonButton("SHARE", icon: "square.and.arrow.up") {
                                showShareSheet = true
                            }
                        }
                        .padding(.horizontal, 16)
                    }
                } else {
                    NeonButton("GENERATE LINK", icon: "link", isLoading: vm.isGeneratingInvite) {
                        Task { await vm.generateInvite() }
                    }
                    .padding(.horizontal, 16)
                }

                NeonButton("CLOSE", style: .secondary) { dismiss() }
                    .padding(.horizontal, 16)

                Spacer()
            }
        }
        .presentationDetents([.medium])
        .sheet(isPresented: $showShareSheet) {
            if let url = vm.inviteURL {
                ShareSheet(items: [url])
            }
        }
    }
}

// MARK: - ShareSheet wrapper

struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }
    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
