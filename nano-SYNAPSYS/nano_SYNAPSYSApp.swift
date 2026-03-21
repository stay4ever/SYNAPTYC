import SwiftUI

@main
struct nano_SYNAPSYSApp: App {
    @StateObject private var authViewModel = AuthViewModel()

    var body: some Scene {
        WindowGroup {
            ZStack {
                // Dark theme background
                AppTheme.Colors.deepBlack
                    .ignoresSafeArea()

                // Navigation based on auth state
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

    /// Configure app on launch
    private func setupApp() {
        // Validate configuration
        do {
            try Config.validateConfiguration()
        } catch {
            print("Configuration validation failed: \(error)")
        }

        // Setup notification service
        NotificationService.shared.requestUserAuthorization()

        // Attempt to restore authentication session
        authViewModel.restoreSession()
    }
}

// MARK: - Splash View
/// Initial loading screen with nano-SYNAPSYS branding
struct SplashView: View {
    @State private var isAnimating = false

    var body: some View {
        ZStack {
            AppTheme.Colors.deepBlack
                .ignoresSafeArea()

            VStack(spacing: 24) {
                Spacer()

                VStack(spacing: 8) {
                    Text("NANO")
                        .font(AppTheme.Typography.monoLargeTitle)
                        .foregroundColor(AppTheme.Colors.neonGreen)
                        .glowText(radius: 12)

                    Text("SYNAPSYS")
                        .font(AppTheme.Typography.monoLargeTitle)
                        .foregroundColor(AppTheme.Colors.neonGreen)
                        .glowText(radius: 12)
                }

                VStack(spacing: 4) {
                    Text("END-TO-END ENCRYPTED")
                        .font(AppTheme.Typography.monoCaption)
                        .foregroundColor(AppTheme.Colors.secondaryText)

                    Text("PRIVACY-FIRST MESSAGING")
                        .font(AppTheme.Typography.monoCaption)
                        .foregroundColor(AppTheme.Colors.secondaryText)
                }

                Spacer()

                // Loading indicator
                HStack(spacing: 6) {
                    ForEach(0..<3, id: \.self) { index in
                        Circle()
                            .fill(AppTheme.Colors.neonGreen)
                            .frame(width: 8, height: 8)
                            .opacity(
                                isAnimating && Double(index) * 0.15 < (Double(Int(Date().timeIntervalSince1970 * 2)) % 1.0)
                                    ? 1.0
                                    : 0.3
                            )
                    }
                }
                .glowText(color: AppTheme.Colors.neonGreen, radius: 4)
                .padding(.bottom, 40)
            }
            .padding()
        }
        .onAppear {
            isAnimating = true
        }
    }
}

// MARK: - Login View Placeholder
/// Login screen (placeholder for full implementation)
struct LoginView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @State private var email = ""
    @State private var password = ""
    @State private var errorMessage: String?

    var body: some View {
        ZStack {
            AppTheme.Colors.deepBlack
                .ignoresSafeArea()

            ScrollView {
                VStack(spacing: 24) {
                    Spacer()
                        .frame(height: 40)

                    VStack(spacing: 8) {
                        Text("NANO")
                            .font(AppTheme.Typography.monoHeadline)
                            .foregroundColor(AppTheme.Colors.neonGreen)
                            .glowText()

                        Text("SYNAPSYS")
                            .font(AppTheme.Typography.monoHeadline)
                            .foregroundColor(AppTheme.Colors.neonGreen)
                            .glowText()
                    }

                    VStack(spacing: 16) {
                        TextField("EMAIL", text: $email)
                            .textFieldStyle(.neon)
                            .textInputAutocapitalization(.never)
                            .keyboardType(.emailAddress)
                            .autocorrectionDisabled()

                        SecureField("PASSWORD", text: $password)
                            .textFieldStyle(.neon)

                        if let errorMessage = errorMessage {
                            Text(errorMessage)
                                .font(AppTheme.Typography.monoCaption)
                                .foregroundColor(AppTheme.Colors.alertRed)
                                .padding(AppTheme.Spacing.md)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }

                        Button(action: handleLogin) {
                            if authViewModel.isLoading {
                                ProgressView()
                                    .progressViewStyle(.circular)
                                    .tint(AppTheme.Colors.deepBlack)
                            } else {
                                Text("LOGIN")
                            }
                        }
                        .neonButtonStyle()
                        .disabled(email.isEmpty || password.isEmpty || authViewModel.isLoading)

                        NavigationLink(destination: RegisterView().environmentObject(authViewModel)) {
                            Text("CREATE ACCOUNT")
                                .font(AppTheme.Typography.monoBody)
                                .foregroundColor(AppTheme.Colors.neonGreen)
                        }
                        .padding(.top, AppTheme.Spacing.md)
                    }
                    .padding(AppTheme.Spacing.lg)
                    .neonCard()

                    Spacer()
                }
                .padding()
            }
        }
        .navigationBarHidden(true)
    }

    private func handleLogin() {
        errorMessage = nil
        authViewModel.login(email: email, password: password) { result in
            switch result {
            case .success:
                break
            case .failure(let error):
                errorMessage = error.localizedDescription
            }
        }
    }
}

// MARK: - Register View Placeholder
/// Registration screen (placeholder for full implementation)
struct RegisterView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @Environment(\.presentationMode) var presentationMode
    @State private var username = ""
    @State private var email = ""
    @State private var password = ""
    @State private var confirmPassword = ""
    @State private var errorMessage: String?

    var body: some View {
        ZStack {
            AppTheme.Colors.deepBlack
                .ignoresSafeArea()

            ScrollView {
                VStack(spacing: 24) {
                    HStack {
                        Button(action: { presentationMode.wrappedValue.dismiss() }) {
                            HStack(spacing: 4) {
                                Image(systemName: "chevron.left")
                                Text("BACK")
                            }
                            .font(AppTheme.Typography.monoBody)
                            .foregroundColor(AppTheme.Colors.neonGreen)
                        }
                        Spacer()
                    }
                    .padding()

                    VStack(spacing: 16) {
                        TextField("USERNAME", text: $username)
                            .textFieldStyle(.neon)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()

                        TextField("EMAIL", text: $email)
                            .textFieldStyle(.neon)
                            .textInputAutocapitalization(.never)
                            .keyboardType(.emailAddress)
                            .autocorrectionDisabled()

                        SecureField("PASSWORD", text: $password)
                            .textFieldStyle(.neon)

                        SecureField("CONFIRM PASSWORD", text: $confirmPassword)
                            .textFieldStyle(.neon)

                        if let errorMessage = errorMessage {
                            Text(errorMessage)
                                .font(AppTheme.Typography.monoCaption)
                                .foregroundColor(AppTheme.Colors.alertRed)
                                .padding(AppTheme.Spacing.md)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }

                        Button(action: handleRegister) {
                            if authViewModel.isLoading {
                                ProgressView()
                                    .progressViewStyle(.circular)
                                    .tint(AppTheme.Colors.deepBlack)
                            } else {
                                Text("CREATE ACCOUNT")
                            }
                        }
                        .neonButtonStyle()
                        .disabled(
                            username.isEmpty || email.isEmpty || password.isEmpty
                                || password != confirmPassword || authViewModel.isLoading
                        )
                    }
                    .padding(AppTheme.Spacing.lg)
                    .neonCard()

                    Spacer()
                }
                .padding()
            }
        }
        .navigationBarHidden(true)
    }

    private func handleRegister() {
        errorMessage = nil

        guard password == confirmPassword else {
            errorMessage = "Passwords do not match"
            return
        }

        authViewModel.register(username: username, email: email, password: password) { result in
            switch result {
            case .success:
                presentationMode.wrappedValue.dismiss()
            case .failure(let error):
                errorMessage = error.localizedDescription
            }
        }
    }
}

// MARK: - Main Tab View Placeholder
/// Main app navigation after authentication
struct MainTabView: View {
    @EnvironmentObject var authViewModel: AuthViewModel

    var body: some View {
        ZStack {
            AppTheme.Colors.deepBlack
                .ignoresSafeArea()

            TabView {
                ConversationsListView()
                    .tabItem {
                        Label("MESSAGES", systemImage: "message.fill")
                    }

                ContactsListView()
                    .tabItem {
                        Label("CONTACTS", systemImage: "person.2.fill")
                    }

                SettingsView()
                    .tabItem {
                        Label("SETTINGS", systemImage: "gear")
                    }
            }
            .onAppear {
                // Configure tab bar appearance
                let appearance = UITabBarAppearance()
                appearance.configureWithTransparentBackground()
                appearance.backgroundColor = AppTheme.Colors.charcoal.withAlphaComponent(0.9)
                appearance.stackedLayoutAppearance.normal.iconColor = AppTheme.Colors.secondaryText
                appearance.stackedLayoutAppearance.normal.titleTextAttributes = [
                    .foregroundColor: AppTheme.Colors.secondaryText
                ]
                appearance.stackedLayoutAppearance.selected.iconColor = AppTheme.Colors.neonGreen
                appearance.stackedLayoutAppearance.selected.titleTextAttributes = [
                    .foregroundColor: AppTheme.Colors.neonGreen
                ]

                UITabBar.appearance().standardAppearance = appearance
                UITabBar.appearance().scrollEdgeAppearance = appearance
            }
        }
        .preferredColorScheme(.dark)
    }
}

// MARK: - Placeholder Views

struct ConversationsListView: View {
    var body: some View {
        ZStack {
            AppTheme.Colors.deepBlack
                .ignoresSafeArea()

            VStack {
                Text("CONVERSATIONS")
                    .font(AppTheme.Typography.monoHeadline)
                    .foregroundColor(AppTheme.Colors.neonGreen)
                    .padding()

                Spacer()
            }
        }
    }
}

struct ContactsListView: View {
    var body: some View {
        ZStack {
            AppTheme.Colors.deepBlack
                .ignoresSafeArea()

            VStack {
                Text("CONTACTS")
                    .font(AppTheme.Typography.monoHeadline)
                    .foregroundColor(AppTheme.Colors.neonGreen)
                    .padding()

                Spacer()
            }
        }
    }
}

struct SettingsView: View {
    @EnvironmentObject var authViewModel: AuthViewModel

    var body: some View {
        ZStack {
            AppTheme.Colors.deepBlack
                .ignoresSafeArea()

            VStack(spacing: 16) {
                Text("SETTINGS")
                    .font(AppTheme.Typography.monoHeadline)
                    .foregroundColor(AppTheme.Colors.neonGreen)
                    .padding()

                Button(action: { authViewModel.logout() }) {
                    Text("LOGOUT")
                }
                .neonButtonStyle()
                .padding()

                Spacer()
            }
        }
    }
}

// MARK: - Preview
#if DEBUG
struct nano_SYNAPSYSApp_Previews: PreviewProvider {
    static var previews: some View {
        SplashView()
    }
}
#endif
