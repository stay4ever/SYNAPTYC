import SwiftUI

struct GroupChatView: View {
    let group: Group
    @StateObject private var vm: GroupChatViewModel
    @State private var inputText = ""
    @State private var showAddMember = false
    @FocusState private var inputFocused: Bool
    @Environment(\.dismiss) private var dismiss

    init(group: Group) {
        self.group = group
        _vm = StateObject(wrappedValue: GroupChatViewModel(group: group))
    }

    var body: some View {
        Color.deepBlack.ignoresSafeArea()
            .overlay(ScanlineOverlay())
            .overlay(
                VStack(spacing: 0) {
                    // Member count bar
                    HStack {
                        Image(systemName: "person.3.fill")
                            .font(.system(size: 11))
                            .foregroundColor(.matrixGreen)
                        Text("\(group.members.count) member\(group.members.count != 1 ? "s" : "")")
                            .font(.monoSmall)
                            .foregroundColor(.matrixGreen)
                        Spacer()
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(Color.darkGreen.opacity(0.3))

                    // Messages
                    ScrollViewReader { proxy in
                        ScrollView {
                            LazyVStack(spacing: 0) {
                                ForEach(vm.messages) { msg in
                                    GroupMessageBubble(message: msg)
                                        .id(msg.id)
                                        .transition(.opacity.combined(with: .move(edge: .bottom)))
                                }
                                Color.clear.frame(height: 1).id("bottom")
                            }
                            .padding(.vertical, 10)
                            .onChange(of: vm.messages.count) { _, _ in
                                withAnimation(.easeOut(duration: 0.2)) {
                                    proxy.scrollTo("bottom", anchor: .bottom)
                                }
                            }
                        }
                        .scrollDismissesKeyboard(.interactively)
                        .onChange(of: inputFocused) { _, focused in
                            if focused {
                                withAnimation(.easeOut(duration: 0.25)) {
                                    proxy.scrollTo("bottom", anchor: .bottom)
                                }
                            }
                        }
                        .onAppear {
                            proxy.scrollTo("bottom", anchor: .bottom)
                        }
                    }

                    if let err = vm.errorMessage {
                        Text("⚠ \(err)")
                            .font(.monoCaption)
                            .foregroundColor(.alertRed)
                            .padding(.horizontal, 16)
                    }

                    // Input bar
                    HStack(spacing: 10) {
                        TextField("Message…", text: $inputText, axis: .vertical)
                            .font(.monoBody)
                            .foregroundColor(.neonGreen)
                            .tint(.neonGreen)
                            .lineLimit(1...5)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .background(Color.darkGreen.opacity(0.35))
                            .overlay(
                                RoundedRectangle(cornerRadius: 20)
                                    .stroke(
                                        inputFocused ? Color.neonGreen.opacity(0.45) : Color.neonGreen.opacity(0.2),
                                        lineWidth: 1
                                    )
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 20))
                            .focused($inputFocused)
                            .onSubmit {
                                guard !inputText.trimmingCharacters(in: .whitespaces).isEmpty else { return }
                                let msg = inputText
                                inputText = ""
                                vm.send(msg)
                            }

                        Button {
                            let msg = inputText
                            inputText = ""
                            vm.send(msg)
                        } label: {
                            Image(systemName: "arrow.up.circle.fill")
                                .font(.system(size: 32))
                                .foregroundColor(
                                    inputText.trimmingCharacters(in: .whitespaces).isEmpty
                                    ? .matrixGreen.opacity(0.3) : .neonGreen
                                )
                                .shadow(color: .neonGreen.opacity(0.3), radius: 4)
                                .animation(.easeInOut(duration: 0.15), value: inputText.isEmpty)
                        }
                        .disabled(inputText.trimmingCharacters(in: .whitespaces).isEmpty)
                        .accessibilityLabel("Send message")
                        .accessibilityAddTraits(.isButton)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .background(Color.darkGreen.opacity(0.5))
                }
            )
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(true)
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button { dismiss() } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 16, weight: .semibold))
                        Text("Back")
                            .font(.system(.subheadline))
                    }
                    .foregroundColor(.neonGreen)
                }
            }
            ToolbarItem(placement: .principal) {
                Text("# \(group.name.uppercased())")
                    .font(.monoHeadline)
                    .foregroundColor(.neonGreen)
                    .glowText()
            }
            ToolbarItem(placement: .navigationBarTrailing) {
                Button { showAddMember = true } label: {
                    Image(systemName: "person.badge.plus")
                        .foregroundColor(.neonGreen)
                }
                .accessibilityLabel("Add member")
            }
        }
        .sheet(isPresented: $showAddMember) {
            AddMemberSheet(group: vm.group) { userId in
                Task { await vm.addMember(userId: userId) }
            }
        }
        .task { await vm.load() }
    }
}

// MARK: - Add Member Sheet

struct AddMemberSheet: View {
    let group: Group
    let onAdd: (Int) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var allUsers: [AppUser] = []
    @State private var isLoading = true
    @State private var searchText = ""

    private var existingIds: Set<Int> { Set(group.members.map { $0.userId }) }

    private var candidates: [AppUser] {
        let me = AuthViewModel.shared.currentUser?.id ?? 0
        let list = allUsers.filter { !existingIds.contains($0.id) && $0.id != me }
        guard !searchText.isEmpty else { return list }
        return list.filter {
            $0.name.localizedCaseInsensitiveContains(searchText) ||
            $0.username.localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        ZStack {
            Color.deepBlack.ignoresSafeArea()
            VStack(spacing: 0) {
                // Header
                HStack {
                    Text("ADD MEMBER")
                        .font(.monoHeadline)
                        .foregroundColor(.neonGreen)
                        .glowText()
                    Spacer()
                    Button { dismiss() } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(.matrixGreen)
                            .font(.system(size: 20))
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 16)

                // Search
                HStack(spacing: 10) {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(.matrixGreen)
                        .font(.system(size: 13))
                    TextField("Search users…", text: $searchText)
                        .font(.monoBody)
                        .foregroundColor(.neonGreen)
                        .tint(.neonGreen)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                }
                .padding(10)
                .background(Color.darkGreen.opacity(0.3))
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .padding(.horizontal, 16)
                .padding(.bottom, 8)

                if isLoading {
                    Spacer()
                    ProgressView().tint(.neonGreen)
                    Spacer()
                } else if candidates.isEmpty {
                    Spacer()
                    Text("No users to add")
                        .font(.monoCaption)
                        .foregroundColor(.matrixGreen.opacity(0.5))
                    Spacer()
                } else {
                    ScrollView {
                        LazyVStack(spacing: 0) {
                            ForEach(candidates) { user in
                                Button {
                                    onAdd(user.id)
                                    dismiss()
                                } label: {
                                    HStack(spacing: 12) {
                                        ZStack {
                                            Circle()
                                                .fill(Color.darkGreen)
                                                .frame(width: 42, height: 42)
                                                .overlay(Circle().stroke(
                                                    user.isOnline == true ? Color.neonGreen.opacity(0.6) : Color.neonGreen.opacity(0.2),
                                                    lineWidth: 1.5))
                                            Text(user.initials)
                                                .font(.system(size: 14, weight: .bold, design: .monospaced))
                                                .foregroundColor(.neonGreen)
                                        }
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(user.name)
                                                .font(.monoBody)
                                                .foregroundColor(.neonGreen)
                                            Text("@\(user.username)")
                                                .font(.monoCaption)
                                                .foregroundColor(.matrixGreen)
                                        }
                                        Spacer()
                                        Image(systemName: "plus.circle")
                                            .foregroundColor(.neonGreen)
                                    }
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 12)
                                    .contentShape(Rectangle())
                                }
                                .buttonStyle(.plain)
                                Divider().background(Color.neonGreen.opacity(0.07))
                            }
                        }
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .task {
            if let users = try? await APIService.shared.users() {
                allUsers = users
            }
            isLoading = false
        }
    }
}

struct GroupMessageBubble: View {
    let message: GroupMessage
    private var isMine: Bool {
        message.fromUser == AuthViewModel.shared.currentUser?.id
    }

    var body: some View {
        HStack(alignment: .bottom, spacing: 0) {
            if isMine { Spacer(minLength: 48) }

            VStack(alignment: isMine ? .trailing : .leading, spacing: 2) {
                if !isMine {
                    Text(message.fromDisplay)
                        .font(.monoSmall)
                        .foregroundColor(.matrixGreen)
                        .padding(.horizontal, 14)
                        .accessibilityLabel("From \(message.fromDisplay)")
                }
                HStack(spacing: 0) {
                    if isMine { Spacer() }
                    VStack(alignment: isMine ? .trailing : .leading, spacing: 4) {
                        Text(message.content)
                            .font(.system(.body))
                            .foregroundColor(isMine ? Color.deepBlack : Color.white.opacity(0.9))
                            .fixedSize(horizontal: false, vertical: true)
                        Text(message.timeString)
                            .font(.system(size: 11))
                            .foregroundColor(isMine ? Color.deepBlack.opacity(0.6) : Color.matrixGreen.opacity(0.6))
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .fill(isMine ? Color.neonGreen : Color.darkGreen)
                            .overlay(
                                RoundedRectangle(cornerRadius: 16, style: .continuous)
                                    .stroke(isMine ? Color.clear : Color.neonGreen.opacity(0.2), lineWidth: 1)
                            )
                    )
                    if !isMine { Spacer() }
                }
            }

            if !isMine { Spacer(minLength: 48) }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(isMine ? "You" : message.fromDisplay): \(message.content). \(message.timeString)")
    }
}
