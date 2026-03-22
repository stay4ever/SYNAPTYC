import SwiftUI

struct GroupChatView: View {
    let group: Group
    @StateObject private var viewModel: GroupChatViewModel
    @State private var messageText = ""
    @Environment(\.dismiss) var dismiss

    init(group: Group) {
        self.group = group
        _viewModel = StateObject(wrappedValue: GroupChatViewModel(groupID: group.id))
    }

    var body: some View {
        ZStack {
            Color(red: 0.0, green: 0.055, blue: 0.0)
                .ignoresSafeArea()

            VStack(spacing: 0) {
                HStack {
                    Button(action: { dismiss() }) {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255))
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        Text(group.name)
                            .font(.system(.headline, design: .monospaced))
                            .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255))

                        Text("\(group.memberCount) MEMBERS")
                            .font(.system(size: 11, weight: .regular, design: .monospaced))
                            .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.6))
                    }

                    Spacer()
                    EncryptionBadge()
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)

                ScrollViewReader { proxy in
                    List {
                        ForEach(viewModel.messages) { message in
                            VStack(alignment: .leading, spacing: 4) {
                                HStack(spacing: 6) {
                                    Text(message.senderName)
                                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                                        .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.7))

                                    Spacer()

                                    Text(message.formattedTime)
                                        .font(.system(size: 10, weight: .regular, design: .monospaced))
                                        .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.4))
                                }

                                Text(message.content)
                                    .font(.system(.body, design: .monospaced))
                                    .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255))
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 10)
                                    .background(Color(red: 0.0, green: 0.1, blue: 0.0))
                                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.4), lineWidth: 1))
                                    .cornerRadius(8)
                            }
                            .listRowBackground(Color.clear)
                            .listRowInsets(EdgeInsets(top: 4, leading: 12, bottom: 4, trailing: 12))
                            .id(message.id)
                        }
                    }
                    .listStyle(.plain)
                    .background(Color.clear)
                    .scrollContentBackground(.hidden)
                    .onChange(of: viewModel.messages.count) {
                        if let last = viewModel.messages.last {
                            withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                        }
                    }
                }

                HStack(spacing: 8) {
                    TextField("MESSAGE...", text: $messageText)
                        .font(.system(.body, design: .monospaced))
                        .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                        .background(Color(red: 0.04, green: 0.1, blue: 0.04))
                        .overlay(RoundedRectangle(cornerRadius: 4).stroke(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.3), lineWidth: 1))

                    Button(action: {
                        let text = messageText.trimmingCharacters(in: .whitespaces)
                        guard !text.isEmpty else { return }
                        viewModel.sendMessage(text)
                        messageText = ""
                    }) {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255))
                    }
                    .disabled(messageText.trimmingCharacters(in: .whitespaces).isEmpty)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Color(red: 0.04, green: 0.1, blue: 0.04).opacity(0.5))
            }
        }
        .navigationBarBackButtonHidden(true)
        .onAppear { viewModel.loadMessages() }
    }
}

#Preview {
    NavigationStack {
        GroupChatView(group: Group.mockGroup)
    }
}
