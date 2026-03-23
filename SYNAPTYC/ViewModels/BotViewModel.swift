import Foundation
import Combine

@MainActor
final class BotViewModel: ObservableObject {
    @Published var messages: [BotMessage]    = []
    @Published var isLoading                 = false
    @Published var errorMessage: String?
    @Published var showAgentsPanel           = false

    private var conversationHistory: [BannerConvMessage] = []
    private var pendingToolResults: [BannerToolResult]   = []

    init() {
        messages.append(BotMessage(role: .assistant,
            content: "BANNER ONLINE ─ Device connected.\n\nI'm your AI agent. I can see your device stats, manage tasks, navigate the app, and write code.\n\nWhat do you need?"))
    }

    // MARK: - Send

    func send(_ text: String) async {
        let trimmed = text.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }

        messages.append(BotMessage(role: .user, content: trimmed))
        conversationHistory.append(BannerConvMessage(role: "user", content: trimmed))

        isLoading     = true
        errorMessage  = nil
        defer { isLoading = false }

        do {
            let context = BannerService.shared.collectContext()
            let history = Array(conversationHistory.dropLast()) // exclude current user message
            let resp = try await APIService.shared.bannerChat(
                message: trimmed,
                conversation: history,
                deviceContext: context,
                toolResults: pendingToolResults
            )
            pendingToolResults.removeAll()

            if !resp.reply.isEmpty {
                messages.append(BotMessage(role: .assistant, content: resp.reply))
                conversationHistory.append(BannerConvMessage(role: "assistant", content: resp.reply))
            }

            // Execute client-side tool calls
            for call in resp.toolCalls {
                await executeToolCall(call)
            }
        } catch {
            errorMessage = error.localizedDescription
            messages.append(BotMessage(role: .assistant, content: "⚠ \(error.localizedDescription)"))
        }
    }

    // MARK: - Tool execution

    private func executeToolCall(_ call: BannerToolCall) async {
        // Add a status card to the chat
        messages.append(BotMessage(role: .assistant, content: "⚡ Executing: \(call.name)…"))
        let result = await BannerService.shared.execute(toolCall: call)
        // Replace status card with result
        if let last = messages.indices.last, messages[last].content.hasPrefix("⚡ Executing:") {
            messages[last] = BotMessage(role: .assistant, content: "✓ \(result)")
        }
        // Queue result for next API call if server requested it
        pendingToolResults.append(BannerToolResult(toolUseId: call.id, result: result))
        if !showAgentsPanel { showAgentsPanel = true }
    }

    // MARK: - Clear history

    func clearHistory() {
        conversationHistory.removeAll()
        messages = [BotMessage(role: .assistant,
            content: "BANNER ONLINE ─ History cleared. How can I help?")]
    }
}
