import SwiftUI

@main
struct nano_SYNAPSYSApp: App {
    @StateObject private var auth    = AuthViewModel.shared
    @Environment(\.scenePhase) var scenePhase
    @State private var showSplash    = true
    @State private var isBlurred     = false

    var body: some Scene {
        WindowGroup {
            ZStack {
                if showSplash {
                    SplashView()
                        .transition(.opacity)
                } else {
                    Group {
                        if auth.isLoggedIn {
                            MainTabView()
                                .environmentObject(auth)
                        } else {
                            LoginView()
                                .environmentObject(auth)
                        }
                    }
                    .transition(.opacity)
                }

                // Screen security blur overlay
                if isBlurred {
                    Color.deepBlack
                        .ignoresSafeArea()
                        .overlay(
                            VStack(spacing: 12) {
                                Image(systemName: "lock.shield.fill")
                                    .font(.system(size: 44))
                                    .foregroundColor(.neonGreen)
                                    .shadow(color: .neonGreen, radius: 12)
                                Text("nano-SYNAPSYS").font(.monoTitle).foregroundColor(.neonGreen).glowText()
                                Text("SECURED").font(.monoCaption).foregroundColor(.matrixGreen).tracking(4)
                            }
                        )
                        .transition(.opacity)
                }
            }
            .animation(.easeInOut(duration: 0.4), value: showSplash)
            .animation(.easeInOut(duration: 0.15), value: isBlurred)
            .animation(.easeInOut(duration: 0.3), value: auth.isLoggedIn)
            .onAppear {
                styleNavigationBar()
                DispatchQueue.main.asyncAfter(deadline: .now() + 2.2) {
                    withAnimation { showSplash = false }
                }
            }
        }
        .onChange(of: scenePhase) { _, newPhase in
            withAnimation {
                isBlurred = (newPhase == .background || newPhase == .inactive) && auth.isLoggedIn
            }
        }
    }

    private func styleNavigationBar() {
        let appearance = UINavigationBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor         = UIColor(Color.deepBlack)
        appearance.titleTextAttributes     = [
            .foregroundColor: UIColor(Color.neonGreen),
            .font: UIFont.monospacedSystemFont(ofSize: 16, weight: .bold)
        ]
        appearance.largeTitleTextAttributes = [
            .foregroundColor: UIColor(Color.neonGreen)
        ]
        appearance.shadowColor = .clear
        UINavigationBar.appearance().standardAppearance   = appearance
        UINavigationBar.appearance().scrollEdgeAppearance = appearance
        UINavigationBar.appearance().compactAppearance    = appearance
        UINavigationBar.appearance().tintColor            = UIColor(Color.neonGreen)
    }
}
