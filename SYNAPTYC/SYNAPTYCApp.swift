import SwiftUI

@main
struct SYNAPTYCApp: App {
    @StateObject private var auth         = AuthViewModel.shared
    @StateObject private var themeManager = ThemeManager.shared
    @Environment(\.scenePhase) var scenePhase
    @State private var showSplash = true
    @State private var isBlurred  = false

    var body: some Scene {
        WindowGroup {
            ZStack {
                if showSplash {
                    SplashView()
                        .transition(.opacity)
                } else {
                    SwiftUI.Group {
                        if auth.requiresBiometric {
                            BiometricLockView()
                                .environmentObject(auth)
                                .environmentObject(themeManager)
                        } else if auth.isLoggedIn {
                            MainTabView()
                                .environmentObject(auth)
                                .environmentObject(themeManager)
                        } else {
                            LoginView()
                                .environmentObject(auth)
                                .environmentObject(themeManager)
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
                                Text("SYNAPTYC").font(.monoTitle).foregroundColor(.neonGreen).glowText()
                                Text("SECURED").font(.monoCaption).foregroundColor(.matrixGreen).tracking(4)
                            }
                        )
                        .transition(.opacity)
                }
            }
            // Force full view-tree re-render when theme changes so all Color.* computed props refresh
            .id(themeManager.activeTheme)
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
            // Reconnect WebSocket when returning to foreground — resets any exhausted retry
            // backoff and re-arms delivery for real-time messages and group messages.
            if newPhase == .active && auth.isLoggedIn {
                WebSocketService.shared.connect()
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

// MARK: - Biometric Lock Screen

struct BiometricLockView: View {
    @EnvironmentObject var auth: AuthViewModel
    @State private var failed = false

    var body: some View {
        ZStack {
            Color.deepBlack.ignoresSafeArea()
            ScanlineOverlay()

            VStack(spacing: 28) {
                Spacer()

                VStack(spacing: 12) {
                    Image(systemName: "faceid")
                        .font(.system(size: 64))
                        .foregroundColor(.neonGreen)
                        .shadow(color: .neonGreen, radius: 18)
                    Text("SYNAPTYC")
                        .font(.monoTitle)
                        .foregroundColor(.neonGreen)
                        .glowText()
                    Text("AUTHENTICATION REQUIRED")
                        .font(.monoCaption)
                        .foregroundColor(.matrixGreen)
                        .tracking(3)
                }

                Spacer()

                VStack(spacing: 14) {
                    if failed {
                        Text("⚠ Authentication failed")
                            .font(.monoCaption)
                            .foregroundColor(.alertRed)
                    }

                    NeonButton("AUTHENTICATE", icon: "faceid") {
                        failed = false
                        Task {
                            await auth.authenticateWithBiometrics()
                            if auth.requiresBiometric { failed = true }
                        }
                    }
                    .padding(.horizontal, 40)

                    Button("Use Password Instead") {
                        auth.usePasswordInstead()
                    }
                    .font(.monoCaption)
                    .foregroundColor(.matrixGreen.opacity(0.7))
                    .padding(.bottom, 40)
                }
            }
        }
        .task {
            await auth.authenticateWithBiometrics()
        }
    }
}
