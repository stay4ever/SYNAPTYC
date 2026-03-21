import SwiftUI

struct MainTabView: View {
    @State private var selectedTab: Int = 0
    @StateObject private var conversationsVM = ConversationsViewModel()
    @StateObject private var groupsVM = GroupsViewModel()
    @StateObject private var botVM = BotViewModel()
    @StateObject private var authVM = AuthViewModel()

    var body: some View {
        ZStack {
            Color(red: 0.0, green: 0.055, blue: 0.0)
                .ignoresSafeArea()

            TabView(selection: $selectedTab) {
                // Conversations tab
                NavigationStack {
                    ConversationsListView()
                        .environmentObject(conversationsVM)
                }
                .tabItem {
                    Label("MESSAGES", systemImage: "bubble.left.fill")
                }
                .tag(0)

                // Groups tab
                NavigationStack {
                    GroupsListView()
                        .environmentObject(groupsVM)
                }
                .tabItem {
                    Label("GROUPS", systemImage: "person.2.fill")
                }
                .tag(1)

                // Bot tab (Banner)
                NavigationStack {
                    BotChatView()
                        .environmentObject(botVM)
                }
                .tabItem {
                    Label("BANNER", systemImage: "sparkles")
                }
                .tag(2)

                // Settings tab
                NavigationStack {
                    SettingsView()
                        .environmentObject(authVM)
                }
                .tabItem {
                    Label("SETTINGS", systemImage: "gear")
                }
                .tag(3)
            }
            .tint(Color(red: 0.0, green: 1.0, blue: 0.255))
            .onAppear {
                // Style tab bar
                let appearance = UITabBarAppearance()
                appearance.configureWithTransparentBackground()
                appearance.backgroundColor = UIColor(red: 0.04, green: 0.1, blue: 0.04, alpha: 0.95)

                // Tab bar border
                appearance.shadowColor = UIColor(red: 0.0, green: 1.0, blue: 0.255).withAlphaComponent(0.3)

                // Text colors
                let normalAttributes: [NSAttributedString.Key: Any] = [
                    .foregroundColor: UIColor(red: 0.0, green: 1.0, blue: 0.255).withAlphaComponent(0.6),
                    .font: UIFont.monospacedSystemFont(ofSize: 10, weight: .regular)
                ]
                let selectedAttributes: [NSAttributedString.Key: Any] = [
                    .foregroundColor: UIColor(red: 0.0, green: 1.0, blue: 0.255),
                    .font: UIFont.monospacedSystemFont(ofSize: 10, weight: .semibold)
                ]

                appearance.stackedLayoutAppearance.normal.titleTextAttributes = normalAttributes
                appearance.stackedLayoutAppearance.selected.titleTextAttributes = selectedAttributes

                UITabBar.appearance().standardAppearance = appearance
                UITabBar.appearance().scrollEdgeAppearance = appearance
            }
        }
    }
}

#Preview {
    MainTabView()
}
