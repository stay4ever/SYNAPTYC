import SwiftUI

struct MainTabView: View {
    @EnvironmentObject var auth: AuthViewModel

    var body: some View {
        TabView {
            ConversationsListView()
                .tabItem {
                    Label("Chats", systemImage: "bubble.left.and.bubble.right.fill")
                }

            GroupsListView()
                .tabItem {
                    Label("Groups", systemImage: "person.3.fill")
                }

            ContactsView()
                .tabItem {
                    Label("Contacts", systemImage: "person.2.fill")
                }

            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gearshape.fill")
                }
        }
        .tint(.neonGreen)
        .onAppear { styleTabBar() }
    }

    private func styleTabBar() {
        let appearance = UITabBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = UIColor(Color.deepBlack)
        appearance.stackedLayoutAppearance.selected.iconColor   = UIColor(Color.neonGreen)
        appearance.stackedLayoutAppearance.selected.titleTextAttributes = [
            .foregroundColor: UIColor(Color.neonGreen),
            .font: UIFont.monospacedSystemFont(ofSize: 10, weight: .medium)
        ]
        appearance.stackedLayoutAppearance.normal.iconColor     = UIColor(Color.matrixGreen.opacity(0.5))
        appearance.stackedLayoutAppearance.normal.titleTextAttributes = [
            .foregroundColor: UIColor(Color.matrixGreen.opacity(0.5))
        ]
        UITabBar.appearance().standardAppearance   = appearance
        UITabBar.appearance().scrollEdgeAppearance = appearance
    }
}
