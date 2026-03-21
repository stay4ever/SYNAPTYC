import Foundation
import Combine

@MainActor
class BotViewModel: ObservableObject {
    @Published var messages: [BotMessage] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var messageText = ""

    private var cancellables = Set<AnyCancellable>()

    init() {
        // Bot messages are stored in memory only for this session
        // No persistence or WebSocket needed
    }

    // MARK: - Send Message to Bot

    func sendMessage() async {
        guard !messageText.trimmingCharacters(in: .whitespaces).isEmpty else { return }

        let userMessage = messageText
        messageText = ""

        // Add user message to conversation
        let userBotMessage = BotMessage(
            id: UUID().uuidString,
            role: "user",
            content: userMessage,
            timestamp: Date()
        )
        messages.append(userBotMessage)

        isLoading = true
        errorMessage = nil

        do {
            // Send to bot API (Claude AI - "Banner")
            let response = try await APIService.shared.sendBotMessage(content: userMessage)

            // Add bot response to conversation
            let botBotMessage = BotMessage(
                id: UUID().uuidString,
                role: "assistant",
                content: response.content,
                timestamp: Date()
            )
            messages.append(botBotMessage)

            isLoading = false
        } catch {
            errorMessage = "Bot response failed: \(error.localizedDescription)"
            isLoading = false

            // Add error message from bot
            let errorBotMessage = BotMessage(
                id: UUID().uuidString,
                role: "assistant",
                content: "Sorry, I encountered an error. Please try again.",
                timestamp: Date()
            )
            messages.append(errorBotMessage)
        }
    }

    // MARK: - Clear Chat History

    func clearHistory() {
        messages.removeAll()
        errorMessage = nil
    }

    // MARK: - Get Conversation Summary

    func getConversationSummary() -> String {
        messages.map { "\($0.role.uppercased()): \($0.content)" }.joined(separator: "\n\n")
    }
}
