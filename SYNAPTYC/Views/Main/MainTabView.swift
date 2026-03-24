import SwiftUI

// MARK: - Floating Tab Bar (build-76 design)

struct MainTabView: View {
    @EnvironmentObject var auth: AuthViewModel
    @State private var selectedTab = 0

    var body: some View {
        currentTab
            .safeAreaInset(edge: .bottom) {
                FloatingTabBar(selectedTab: $selectedTab)
            }
        .onReceive(NotificationCenter.default.publisher(for: .bannerTabSwitch)) { note in
            guard let screen = note.object as? String else { return }
            switch screen {
            case "conversations": selectedTab = 0
            case "groups":        selectedTab = 1
            case "contacts":      selectedTab = 2
            case "settings":      selectedTab = 3
            default:              break
            }
        }
    }

    @ViewBuilder
    private var currentTab: some View {
        switch selectedTab {
        case 0: ConversationsListView()
        case 1: GroupsListView()
        case 2: ContactsView()
        default: SettingsView()
        }
    }
}

// MARK: - Floating Tab Bar

private struct FloatingTabBar: View {
    @Binding var selectedTab: Int

    private let tabs: [(icon: String, label: String)] = [
        ("bubble.left.and.bubble.right.fill", "CHATS"),
        ("person.3.fill",                     "GROUPS"),
        ("person.2.fill",                     "CONTACTS"),
        ("gearshape.fill",                    "SETTINGS")
    ]

    var body: some View {
        HStack(spacing: 0) {
            ForEach(tabs.indices, id: \.self) { idx in
                FloatingTabItem(
                    icon:     tabs[idx].icon,
                    label:    tabs[idx].label,
                    isActive: selectedTab == idx
                ) { selectedTab = idx }
            }
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 2)
        .background(
            RoundedRectangle(cornerRadius: 28)
                .fill(Color.darkGreen.opacity(0.97))
                .overlay(
                    RoundedRectangle(cornerRadius: 28)
                        .stroke(Color.neonGreen.opacity(0.25), lineWidth: 1)
                )
                .shadow(color: Color.neonGreen.opacity(0.22), radius: 22, x: 0, y: 6)
        )
        .padding(.horizontal, 12)
        .padding(.bottom, 6)
    }
}

// MARK: - Tab Item

private struct FloatingTabItem: View {
    let icon: String
    let label: String
    let isActive: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.system(size: 20))
                    .foregroundColor(isActive ? .neonGreen : .matrixGreen.opacity(0.5))

                Text(label)
                    .font(.system(size: 7, design: .monospaced).weight(isActive ? .bold : .regular))
                    .foregroundColor(isActive ? .neonGreen : .matrixGreen.opacity(0.5))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 4)
            .overlay(alignment: .top) {
                if isActive {
                    Capsule()
                        .fill(Color.neonGreen)
                        .frame(height: 2)
                        .padding(.horizontal, 20)
                        .offset(y: -1)
                        .shadow(color: .neonGreen, radius: 6)
                }
            }
        }
        .buttonStyle(.plain)
    }
}
