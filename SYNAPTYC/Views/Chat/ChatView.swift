import SwiftUI

struct ChatView: View {
    let peer: AppUser
    @StateObject private var vm: ChatViewModel
    @State private var inputText       = ""
    @State private var showTimerPicker = false
    @FocusState private var inputFocused: Bool
    @State private var scrollToBottom  = false
    @Environment(\.dismiss) private var dismiss

    init(peer: AppUser) {
        self.peer = peer
        _vm = StateObject(wrappedValue: ChatViewModel(peer: peer))
    }

    var body: some View {
        ZStack {
            Color.deepBlack.ignoresSafeArea()

            VStack(spacing: 0) {
                // Messages
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 0) {
                            ForEach(vm.messages) { msg in
                                let isMine = msg.fromUser == AuthViewModel.shared.currentUser?.id
                                MessageBubble(message: msg, isMine: isMine) {
                                    vm.deleteMessage(id: msg.id)
                                }
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
                    TextField("Message…", text: $inputText, axis: .vertical)
                        .font(.monoBody)
                        .foregroundColor(.neonGreen)
                        .tint(.neonGreen)
                        .lineLimit(1...5)
                        .autocorrectionDisabled(false)
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
            ToolbarItem(placement: .navigationBarTrailing) {
                Button { showTimerPicker = true } label: {
                    Image(systemName: vm.disappearTimer == .off ? "timer" : "timer.circle.fill")
                        .foregroundColor(vm.disappearTimer == .off ? .matrixGreen.opacity(0.6) : .amber)
                }
                .accessibilityLabel("Disappearing messages timer")
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
