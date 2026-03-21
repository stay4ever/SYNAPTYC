import SwiftUI

// swiftlint:disable:next type_name
@main
struct nano_SYNAPSYSApp: App {
    @StateObject private var authViewModel = AuthViewModel()

    var body: some Scene {
        WindowGroup {
            ZStack {
                AppTheme.Colors.deepBlack
                    .ignoresSafeArea()

                if authViewModel.isLoading {
                    SplashView()
                } else if authViewModel.isAuthenticated {
                    MainTabView()
                        .environmentObject(authViewModel)
                } else {
                    LoginView()
                        .environmentObject(authViewModel)
                }
            }
            .onAppear {
                setupApp()
            }
        }
    }

    private func setupApp() {
        do {
            try Config.validateConfiguration()
        } catch {
            print("Configuration validation failed: \(error)")
        }

        NotificationService.shared.requestUserAuthorization()
        authViewModel.restoreSession()
    }
}

#if DEBUG
// swiftlint:disable:next type_name
struct nano_SYNAPSYSApp_Previews: PreviewProvider {
    static var previews: some View {
        SplashView()
    }
}
#endif
