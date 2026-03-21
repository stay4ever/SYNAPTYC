import Foundation
import Combine

@MainActor
class BotViewModel: ObservableObject {
    @Published var botMessages: [BotMessage] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    init() {}

    var messages: [BotMessage] { botMessages }

    func loadMessages() {
        // Bot messages are session-only, no persistence
    }

    func sendMessage(_ content: String) {
        Task { await sendMessageAsync(content) }
    }

    private func sendMessageAsync(_ content: String) async {
        guard !content.trimmingCharacters(in: .whitespaces).isEmpty else { return }

        let userMessage = BotMessage(content: content, isFromUser: true)
        botMessages.append(userMessage)

        isLoading = true
        errorMessage = nil

        do {
            let response = try await APIService.shared.sendBotMessage(content: content)
            let botResponse = BotMessage(content: response.content, isFromUser: false)
            botMessages.append(botResponse)
        } catch {
            errorMessage = "Bot response failed: \(error.localizedDescription)"
            let errorMsg = BotMessage(content: "Sorry, I encountered an error. Please try again.", isFromUser: false)
            botMessages.append(errorMsg)
        }
        isLoading = false
    }

    func clearHistory() {
        botMessages.removeAll()
        errorMessage = nil
    }
}
