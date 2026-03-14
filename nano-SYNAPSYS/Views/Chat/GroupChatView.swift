import SwiftUI

struct GroupChatView: View {
    let group: Group
    @StateObject private var vm: GroupChatViewModel
    @State private var inputText = ""
    @FocusState private var inputFocused: Bool

    init(group: Group) {
        self.group = group
        _vm = StateObject(wrappedValue: GroupChatViewModel(group: group))
    }

    var body: some View {
        ZStack {
            Color.deepBlack.ignoresSafeArea()
            ScanlineOverlay()

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
                    EncryptionBadge(isActive: vm.encryptionReady)
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
                        }
                        .padding(.vertical, 10)
                        .onChange(of: vm.messages.count) { _ in
                            withAnimation {
                                proxy.scrollTo(vm.messages.last?.id, anchor: .bottom)
                            }
                        }
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
                    TextField("Encrypted message…", text: $inputText, axis: .vertical)
                        .font(.monoBody)
                        .foregroundColor(.neonGreen)
                        .tint(.neonGreen)
                        .lineLimit(1...5)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(Color.darkGreen.opacity(0.35))
                        .overlay(
                            RoundedRectangle(cornerRadius: 20)
                                .stroke(Color.neonGreen.opacity(0.2), lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 20))
                        .focused($inputFocused)

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
                    }
                    .disabled(inputText.trimmingCharacters(in: .whitespaces).isEmpty)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .background(Color.darkGreen.opacity(0.5))
            }
        }
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                VStack(spacing: 1) {
                    Text("# \(group.name.uppercased())")
                        .font(.monoHeadline)
                        .foregroundColor(.neonGreen)
                        .glowText()
                }
            }
        }
        .task { await vm.load() }
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
                }
                HStack(spacing: 0) {
                    if isMine { Spacer() }
                    VStack(alignment: isMine ? .trailing : .leading, spacing: 4) {
                        Text(message.content)
                            .font(.monoBody)
                            .foregroundColor(isMine ? Color.deepBlack : Color.neonGreen)
                            .fixedSize(horizontal: false, vertical: true)
                        Text(message.timeString)
                            .font(.system(size: 9, design: .monospaced))
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
    }
}
