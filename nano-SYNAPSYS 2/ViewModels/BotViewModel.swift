import Foundation

@MainActor
final class BotViewModel: ObservableObject {
    @Published var messages: [BotMessage] = []
    @Published var isLoading              = false
    @Published var errorMessage: String?

    init() {
        messages.append(BotMessage(role: .assistant,
            content: "SYSTEM ONLINE — nano-SYNAPSYS AI assistant initialised.\n\nI'm Banner, your encrypted AI companion. Ask me anything."))
    }

    func send(_ text: String) async {
        guard !text.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        messages.append(BotMessage(role: .user, content: text))
        isLoading = true
        defer { isLoading = false }
        do {
            let reply = try await APIService.shared.botChat(message: text)
            messages.append(BotMessage(role: .assistant, content: reply))
        } catch {
            errorMessage = error.localizedDescription
            messages.append(BotMessage(role: .assistant,
                content: "⚠ Connection error. Check your network and try again."))
        }
    }
}
