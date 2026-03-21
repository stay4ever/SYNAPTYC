import Foundation
import Combine
import CryptoKit

@MainActor
class AuthViewModel: ObservableObject {
    @Published var isAuthenticated = false
    @Published var isLoading = true
    @Published var errorMessage: String = ""
    @Published var currentUser: AppUser?

    // Form fields used by LoginView / RegisterView
    @Published var username = ""
    @Published var password = ""
    @Published var confirmPassword = ""
    @Published var displayName = ""

    init() {}

    // MARK: - Restore Session

    func restoreSession() {
        if let token = KeychainService.shared.load(key: "jwt_token") {
            Task {
                do {
                    let user = try await APIService.shared.verifyToken(token: token)
                    self.currentUser = user
                    self.isAuthenticated = true
                } catch {
                    try? KeychainService.shared.delete(key: "jwt_token")
                    self.isAuthenticated = false
                    self.currentUser = nil
                }
                self.isLoading = false
            }
        } else {
            isLoading = false
        }
    }

    // MARK: - Login

    func login() {
        Task { await loginAsync() }
    }

    private func loginAsync() async {
        isLoading = true
        errorMessage = ""
        do {
            let response = try await APIService.shared.login(username: username, password: password)
            try? KeychainService.shared.save(key: "jwt_token", value: response.token)
            currentUser = response.user
            isAuthenticated = true
        } catch {
            errorMessage = "Login failed: \(error.localizedDescription)"
        }
        isLoading = false
    }

    // MARK: - Register

    func register() {
        Task { await registerAsync() }
    }

    private func registerAsync() async {
        isLoading = true
        errorMessage = ""
        do {
            let response = try await APIService.shared.register(
                username: username,
                password: password,
                displayName: displayName
            )
            try? KeychainService.shared.save(key: "jwt_token", value: response.token)
            currentUser = response.user
            isAuthenticated = true
        } catch {
            errorMessage = "Registration failed: \(error.localizedDescription)"
        }
        isLoading = false
    }

    // MARK: - Logout

    func logout() {
        Task {
            isLoading = true
            try? await APIService.shared.logout()
            try? KeychainService.shared.delete(key: "jwt_token")
            currentUser = nil
            isAuthenticated = false
            isLoading = false
        }
    }
}
