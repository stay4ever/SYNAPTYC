import SwiftUI

// MARK: - BannerView (replaces BotChatView)

struct BotChatView: View {
    @StateObject private var vm      = BotViewModel()
    @StateObject private var banner  = BannerService.shared
    @Environment(\.dismiss) var dismiss
    @State private var inputText     = ""
    @State private var showClear     = false
    @FocusState private var focused: Bool

    // Live device context for the header chips
    private var ctx: BannerDeviceContext { banner.collectContext() }

    var body: some View {
        ZStack {
            Color.deepBlack.ignoresSafeArea()
            ScanlineOverlay()

            VStack(spacing: 0) {
                headerBar
                statusChips
                Divider().background(Color.neonGreen.opacity(0.12))
                messageList
                if let err = vm.errorMessage {
                    Text("⚠ \(err)").font(.monoCaption).foregroundColor(.alertRed)
                        .padding(.horizontal, 16).padding(.top, 4)
                }
                if vm.showAgentsPanel { agentsPanel }
                inputBar
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .bannerNavigate)) { note in
            if let screen = note.object as? String {
                handleNavigation(screen)
            }
        }
    }

    // MARK: - Header

    private var headerBar: some View {
        HStack(spacing: 10) {
            ZStack {
                Circle().fill(Color.darkGreen).frame(width: 32, height: 32)
                    .overlay(Circle().stroke(Color.neonGreen.opacity(0.4), lineWidth: 1))
                Image(systemName: "cpu.fill").font(.system(size: 13)).foregroundColor(.neonGreen)
            }
            VStack(alignment: .leading, spacing: 1) {
                Text("BANNER").font(.monoHeadline).foregroundColor(.neonGreen).glowText()
                Text("AI Agent · Claude").font(.monoSmall).foregroundColor(.matrixGreen)
            }
            Spacer()
            HStack(spacing: 8) {
                PulsatingDot(color: .neonGreen, size: 6)
                Text("ONLINE").font(.monoSmall).foregroundColor(.neonGreen)
            }
            Button { showClear = true } label: {
                Image(systemName: "trash").font(.system(size: 14)).foregroundColor(.matrixGreen.opacity(0.6))
            }
            .padding(.leading, 4)
            Button { dismiss() } label: {
                Image(systemName: "xmark.circle.fill").font(.system(size: 20))
                    .foregroundColor(.matrixGreen.opacity(0.5))
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Color.darkGreen.opacity(0.4))
        .alert("Clear History?", isPresented: $showClear) {
            Button("Clear", role: .destructive) { vm.clearHistory() }
            Button("Cancel", role: .cancel) {}
        }
    }

    // MARK: - Status chips

    private var statusChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                chip(icon: "battery.75", label: batteryLabel, color: batteryColor)
                chip(icon: "wifi",       label: ctx.networkType.uppercased(), color: .neonGreen)
                chip(icon: "internaldrive", label: "\(String(format: "%.0f", ctx.storageFreeGB))GB free", color: .matrixGreen)
                chip(icon: "iphone",     label: "iOS \(ctx.iosVersion)", color: .matrixGreen)
                if !banner.tasks.isEmpty {
                    chip(icon: "list.bullet", label: "\(banner.tasks.filter { $0.status == .running }.count) running", color: .neonGreen)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 7)
        }
        .background(Color.black.opacity(0.3))
    }

    private func chip(icon: String, label: String, color: Color) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon).font(.system(size: 9)).foregroundColor(color)
            Text(label).font(.monoSmall).foregroundColor(color)
        }
        .padding(.horizontal, 8).padding(.vertical, 4)
        .background(color.opacity(0.08))
        .overlay(RoundedRectangle(cornerRadius: 6).stroke(color.opacity(0.25), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 6))
    }

    private var batteryLabel: String {
        let lvl = ctx.batteryLevel
        if lvl < 0 { return "—" }
        return "\(Int(lvl * 100))%"
    }

    private var batteryColor: Color {
        let lvl = ctx.batteryLevel
        if lvl < 0.2 { return .alertRed }
        if lvl < 0.4 { return Color.orange }
        return .neonGreen
    }

    // MARK: - Messages

    private var messageList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 10) {
                    ForEach(vm.messages) { msg in
                        BannerBubble(msg: msg)
                            .id(msg.id)
                            .transition(.opacity.combined(with: .move(edge: .bottom)))
                    }
                    if vm.isLoading {
                        HStack { TypingIndicator(); Spacer() }
                            .padding(.horizontal, 16)
                            .id("loading")
                    }
                }
                .padding(.vertical, 12)
                .onChange(of: vm.messages.count) { _, _ in
                    withAnimation { proxy.scrollTo(vm.messages.last?.id, anchor: .bottom) }
                }
                .onChange(of: vm.isLoading) { _, loading in
                    if loading { withAnimation { proxy.scrollTo("loading", anchor: .bottom) } }
                }
            }
        }
    }

    // MARK: - Agents panel

    private var agentsPanel: some View {
        VStack(spacing: 0) {
            HStack {
                Image(systemName: "list.bullet.rectangle").foregroundColor(.neonGreen).font(.system(size: 11))
                Text("ACTIVE AGENTS (\(banner.tasks.count))").font(.monoSmall).foregroundColor(.neonGreen)
                Spacer()
                Button { BannerService.shared.clearDone() } label: {
                    Text("CLEAR DONE").font(.monoSmall).foregroundColor(.matrixGreen.opacity(0.6))
                }
                Button { withAnimation { vm.showAgentsPanel.toggle() } } label: {
                    Image(systemName: vm.showAgentsPanel ? "chevron.down" : "chevron.up")
                        .font(.system(size: 11)).foregroundColor(.matrixGreen)
                }
            }
            .padding(.horizontal, 14).padding(.vertical, 7)
            .background(Color.darkGreen.opacity(0.5))

            if vm.showAgentsPanel {
                ScrollView {
                    VStack(spacing: 4) {
                        ForEach(banner.tasks) { task in
                            BannerTaskRow(task: task)
                        }
                    }
                    .padding(.horizontal, 12).padding(.vertical, 6)
                }
                .frame(maxHeight: 130)
                .background(Color.black.opacity(0.3))
            }
        }
    }

    // MARK: - Input

    private var inputBar: some View {
        HStack(spacing: 10) {
            TextField("Ask Banner…", text: $inputText, axis: .vertical)
                .font(.monoBody).foregroundColor(.neonGreen).tint(.neonGreen)
                .lineLimit(1...5)
                .autocorrectionDisabled(false)
                .padding(.horizontal, 14).padding(.vertical, 10)
                .background(Color.darkGreen.opacity(0.35))
                .overlay(RoundedRectangle(cornerRadius: 20).stroke(Color.neonGreen.opacity(0.2), lineWidth: 1))
                .clipShape(RoundedRectangle(cornerRadius: 20))
                .focused($focused)
                .onSubmit { sendMessage() }

            Button { sendMessage() } label: {
                Image(systemName: vm.isLoading ? "stop.circle" : "arrow.up.circle.fill")
                    .font(.system(size: 32))
                    .foregroundColor(inputText.trimmingCharacters(in: .whitespaces).isEmpty
                                     ? .matrixGreen.opacity(0.3) : .neonGreen)
                    .shadow(color: .neonGreen.opacity(0.3), radius: 6)
            }
            .disabled(inputText.trimmingCharacters(in: .whitespaces).isEmpty || vm.isLoading)
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
        .background(Color.darkGreen.opacity(0.5))
    }

    private func sendMessage() {
        let msg = inputText.trimmingCharacters(in: .whitespaces)
        guard !msg.isEmpty else { return }
        inputText = ""
        focused   = false
        Task { await vm.send(msg) }
    }

    private func handleNavigation(_ screen: String) {
        // Post to root so MainTabView can switch tabs
        NotificationCenter.default.post(name: .bannerTabSwitch, object: screen)
        dismiss()
    }
}

// MARK: - Banner bubble

struct BannerBubble: View {
    let msg: BotMessage
    private var isUser: Bool { msg.role == .user }
    private var isStatus: Bool { msg.content.hasPrefix("⚡") || msg.content.hasPrefix("✓") }

    var body: some View {
        if isStatus {
            HStack(spacing: 6) {
                Text(msg.content)
                    .font(.monoSmall)
                    .foregroundColor(.matrixGreen)
                Spacer()
            }
            .padding(.horizontal, 18)
        } else {
            HStack(alignment: .bottom, spacing: 8) {
                if isUser { Spacer(minLength: 60) }
                else {
                    ZStack {
                        Circle().fill(Color.darkGreen).frame(width: 26, height: 26)
                            .overlay(Circle().stroke(Color.neonGreen.opacity(0.3), lineWidth: 1))
                        Image(systemName: "cpu").font(.system(size: 11)).foregroundColor(.neonGreen)
                    }
                    .alignmentGuide(.bottom) { d in d[.bottom] }
                }

                // Parse content for code blocks
                parsedContent
                    .padding(.horizontal, 12).padding(.vertical, 9)
                    .background(bubbleBackground)
                    .clipShape(bubbleShape)
                    .overlay(bubbleShape.stroke(
                        isUser ? Color.neonGreen : Color.neonGreen.opacity(0.18),
                        lineWidth: 1
                    ))

                if !isUser { Spacer(minLength: 60) }
            }
            .padding(.horizontal, 14)
        }
    }

    @ViewBuilder
    private var parsedContent: some View {
        let parts = splitCodeBlocks(msg.content)
        VStack(alignment: .leading, spacing: 6) {
            ForEach(parts.indices, id: \.self) { i in
                let (text, isCode) = parts[i]
                if isCode {
                    ScrollView(.horizontal, showsIndicators: false) {
                        Text(text)
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundColor(.neonGreen)
                            .padding(8)
                    }
                    .background(Color.black.opacity(0.5))
                    .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.neonGreen.opacity(0.25), lineWidth: 1))
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                } else if !text.isEmpty {
                    Text(text)
                        .font(.monoBody)
                        .foregroundColor(isUser ? .deepBlack : .neonGreen)
                }
            }
        }
    }

    private var bubbleBackground: some ShapeStyle {
        isUser ? AnyShapeStyle(Color.neonGreen) : AnyShapeStyle(Color.darkGreen)
    }

    private var bubbleShape: UnevenRoundedRectangle {
        UnevenRoundedRectangle(
            topLeadingRadius:     isUser ? 18 : 4,
            bottomLeadingRadius:  18,
            bottomTrailingRadius: 18,
            topTrailingRadius:    isUser ? 4 : 18
        )
    }

    /// Split message into alternating [text, code block] segments.
    private func splitCodeBlocks(_ text: String) -> [(String, Bool)] {
        var results: [(String, Bool)] = []
        var remaining = text
        while let start = remaining.range(of: "```") {
            let before = String(remaining[remaining.startIndex..<start.lowerBound])
            if !before.isEmpty { results.append((before, false)) }
            remaining = String(remaining[start.upperBound...])
            if let end = remaining.range(of: "```") {
                var code = String(remaining[remaining.startIndex..<end.lowerBound])
                // Strip language tag from first line
                if let nl = code.firstIndex(of: "\n") {
                    code = String(code[code.index(after: nl)...])
                }
                results.append((code.trimmingCharacters(in: .newlines), true))
                remaining = String(remaining[end.upperBound...])
            } else {
                results.append((remaining, true))
                return results
            }
        }
        if !remaining.isEmpty { results.append((remaining, false)) }
        return results.isEmpty ? [(text, false)] : results
    }
}

// MARK: - Agent task row

struct BannerTaskRow: View {
    let task: BannerAgentTask

    var statusColor: Color {
        switch task.status {
        case .pending: return .matrixGreen
        case .running: return .neonGreen
        case .done:    return .matrixGreen.opacity(0.6)
        case .failed:  return .alertRed
        }
    }

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: task.status.color)
                .font(.system(size: 11))
                .foregroundColor(statusColor)
                .rotationEffect(task.status == .running ? .degrees(360) : .degrees(0))
                .animation(task.status == .running
                    ? Animation.linear(duration: 1.2).repeatForever(autoreverses: false)
                    : .default, value: task.status == .running)
            VStack(alignment: .leading, spacing: 1) {
                Text(task.title).font(.monoSmall).foregroundColor(.neonGreen).lineLimit(1)
                if let desc = task.description {
                    Text(desc).font(.system(size: 9, design: .monospaced))
                        .foregroundColor(.matrixGreen).lineLimit(1)
                }
            }
            Spacer()
            Text(task.status.label).font(.monoSmall).foregroundColor(statusColor)
        }
        .padding(.horizontal, 8).padding(.vertical, 5)
        .background(Color.darkGreen.opacity(0.3))
        .clipShape(RoundedRectangle(cornerRadius: 6))
    }
}

extension Notification.Name {
    static let bannerTabSwitch = Notification.Name("bannerTabSwitch")
}
