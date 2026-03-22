import SwiftUI

struct ChatView: View {
    let peer: AppUser
    @StateObject private var vm: ChatViewModel
    @State private var inputText       = ""
    @State private var showTimerPicker = false
    @FocusState private var inputFocused: Bool
    @State private var scrollToBottom  = false

    init(peer: AppUser) {
        self.peer = peer
        _vm = StateObject(wrappedValue: ChatViewModel(peer: peer))
    }

    var body: some View {
        ZStack {
            Color.deepBlack.ignoresSafeArea()
            ScanlineOverlay()

            VStack(spacing: 0) {
                // Encryption status bar
                HStack {
                    EncryptionBadge(isActive: vm.encryptionReady)
                    Spacer()
                    Button { showTimerPicker = true } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "timer")
                                .font(.system(size: 11))
                            Text(vm.disappearTimer == .off ? "No timer" : vm.disappearTimer.rawValue)
                                .font(.monoSmall)
                        }
                        .foregroundColor(vm.disappearTimer == .off ? .matrixGreen.opacity(0.5) : .amber)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(Color.darkGreen.opacity(0.4))
                        .overlay(Capsule().stroke(Color.matrixGreen.opacity(0.2), lineWidth: 1))
                        .clipShape(Capsule())
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(Color.darkGreen.opacity(0.3))

                // Messages
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 0) {
                            ForEach(vm.messages) { msg in
                                let isMine = msg.fromUser == AuthViewModel.shared.currentUser?.id
                                MessageBubble(message: msg, isMine: isMine)
                                    .id(msg.id)
                                    .transition(.opacity.combined(with: .move(edge: isMine ? .trailing : .leading)))
                            }
                            if vm.isTyping {
                                HStack {
                                    TypingIndicator()
                                    Spacer()
                                }
                                .padding(.horizontal, 14)
                                .padding(.vertical, 4)
                                .id("typing")
                            }
                        }
                        .padding(.vertical, 10)
                        .onChange(of: vm.messages.count) { _, _ in
                            withAnimation { proxy.scrollTo(vm.messages.last?.id, anchor: .bottom) }
                        }
                        .onChange(of: vm.isTyping) { _, newTyping in
                            if newTyping { withAnimation { proxy.scrollTo("typing", anchor: .bottom) } }
                        }
                    }
                }

                // Error
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
                        .onChange(of: inputText) { _, _ in
                            vm.sendTypingIndicator()
                        }

                    Button {
                        let msg = inputText
                        inputText = ""
                        Task { await vm.send(msg) }
                    } label: {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.system(size: 32))
                            .foregroundColor(inputText.trimmingCharacters(in: .whitespaces).isEmpty
                                             ? .matrixGreen.opacity(0.3) : .neonGreen)
                            .shadow(color: .neonGreen.opacity(0.3), radius: 4)
                    }
                    .disabled(inputText.trimmingCharacters(in: .whitespaces).isEmpty)
                    .accessibilityLabel("Send message")
                    .accessibilityAddTraits(.isButton)
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
                HStack(spacing: 8) {
                    OnlineDot(isOnline: peer.isOnline ?? false)
                    VStack(spacing: 1) {
                        Text(peer.name)
                            .font(.monoHeadline)
                            .foregroundColor(.neonGreen)
                        if peer.isOnline == true {
                            Text("online").font(.monoSmall).foregroundColor(.matrixGreen)
                        }
                    }
                }
            }
        }
        .task { await vm.load() }
        .confirmationDialog("Disappearing Messages", isPresented: $showTimerPicker) {
            ForEach(DisappearTimer.allCases) { timer in
                Button(timer.label) { vm.disappearTimer = timer }
            }
            Button("Cancel", role: .cancel) {}
        }
        .onDisappear { vm.purgeExpired() }
    }
}
