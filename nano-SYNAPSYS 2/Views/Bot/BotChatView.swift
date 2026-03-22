import SwiftUI

struct BotChatView: View {
    @StateObject private var vm    = BotViewModel()
    @State private var inputText   = ""
    @FocusState private var focused: Bool

    var body: some View {
        ZStack {
            Color.deepBlack.ignoresSafeArea()
            ScanlineOverlay()

            VStack(spacing: 0) {
                // Status bar
                HStack {
                    Image(systemName: "cpu.fill").foregroundColor(.neonGreen).font(.system(size: 12))
                    Text("Banner AI · Powered by Claude").font(.monoCaption).foregroundColor(.matrixGreen)
                    Spacer()
                    PulsatingDot(color: .neonGreen, size: 6)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(Color.darkGreen.opacity(0.3))

                // Messages
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 12) {
                            ForEach(vm.messages) { msg in
                                BotBubble(msg: msg)
                                    .id(msg.id)
                                    .transition(.opacity)
                            }
                            if vm.isLoading {
                                HStack {
                                    TypingIndicator()
                                    Spacer()
                                }
                                .padding(.horizontal, 16)
                                .id("loading")
                            }
                        }
                        .padding(.vertical, 14)
                        .onChange(of: vm.messages.count) { _, _ in
                            withAnimation { proxy.scrollTo(vm.messages.last?.id, anchor: .bottom) }
                        }
                        .onChange(of: vm.isLoading) { _, newLoading in
                            if newLoading { withAnimation { proxy.scrollTo("loading", anchor: .bottom) } }
                        }
                    }
                }

                if let err = vm.errorMessage {
                    Text("⚠ \(err)").font(.monoCaption).foregroundColor(.alertRed).padding(.horizontal, 16)
                }

                // Input
                HStack(spacing: 10) {
                    TextField("Ask Banner…", text: $inputText, axis: .vertical)
                        .font(.monoBody).foregroundColor(.neonGreen).tint(.neonGreen)
                        .lineLimit(1...4)
                        .padding(.horizontal, 14).padding(.vertical, 10)
                        .background(Color.darkGreen.opacity(0.35))
                        .overlay(RoundedRectangle(cornerRadius: 20).stroke(Color.neonGreen.opacity(0.2), lineWidth: 1))
                        .clipShape(RoundedRectangle(cornerRadius: 20))
                        .focused($focused)
                        .submitLabel(.send)
                        .onSubmit { sendMessage() }

                    Button { sendMessage() } label: {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.system(size: 32))
                            .foregroundColor(inputText.trimmingCharacters(in: .whitespaces).isEmpty
                                             ? .matrixGreen.opacity(0.3) : .neonGreen)
                            .shadow(color: .neonGreen.opacity(0.3), radius: 4)
                    }
                    .disabled(inputText.trimmingCharacters(in: .whitespaces).isEmpty || vm.isLoading)
                }
                .padding(.horizontal, 12).padding(.vertical, 10)
                .background(Color.darkGreen.opacity(0.5))
            }
        }
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                HStack(spacing: 6) {
                    Image(systemName: "cpu.fill").foregroundColor(.neonGreen).font(.system(size: 13))
                    Text("Banner AI").font(.monoHeadline).foregroundColor(.neonGreen).glowText()
                }
            }
        }
    }

    private func sendMessage() {
        let msg = inputText.trimmingCharacters(in: .whitespaces)
        guard !msg.isEmpty else { return }
        inputText = ""
        Task { await vm.send(msg) }
    }
}

struct BotBubble: View {
    let msg: BotMessage

    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            if msg.role == .assistant {
                ZStack {
                    Circle().fill(Color.darkGreen).frame(width: 28, height: 28)
                        .overlay(Circle().stroke(Color.neonGreen.opacity(0.3), lineWidth: 1))
                    Image(systemName: "cpu").font(.system(size: 12)).foregroundColor(.neonGreen)
                }
                .alignmentGuide(.bottom) { d in d[.bottom] }
            } else {
                Spacer(minLength: 50)
            }

            Text(msg.content)
                .font(.monoBody)
                .foregroundColor(msg.role == .user ? .deepBlack : .neonGreen)
                .padding(.horizontal, 12).padding(.vertical, 8)
                .background(msg.role == .user ? Color.neonGreen : Color.darkGreen)
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .shadow(color: msg.role == .assistant ? Color.neonGreen.opacity(0.08) : .clear, radius: 4)

            if msg.role == .user {
                Spacer(minLength: 50)
            } else {
                Spacer(minLength: 50)
            }
        }
        .padding(.horizontal, 14)
    }
}
