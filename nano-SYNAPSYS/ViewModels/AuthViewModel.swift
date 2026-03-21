import Foundation
import Combine
import CryptoKit

@MainActor
class AuthViewModel: ObservableObject {
    @Published var isAuthenticated = false
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var currentUser: AppUser?

    private var cancellables = Set<AnyCancellable>()

    init() {
        checkSavedToken()
    }

    // MARK: - Auto-login

    private func checkSavedToken() {
        if let token = KeychainService.shared.loadString(key: "jwt_token") {
            // Token exists; verify it's still valid
            Task {
                do {
                    let user = try await APIService.shared.verifyToken(token: token)
                    await MainActor.run {
                        self.currentUser = user
                        self.isAuthenticated = true
                    }
                } catch {
                    // Token invalid or expired
                    KeychainService.shared.deleteString(key: "jwt_token")
                    await MainActor.run {
                        self.isAuthenticated = false
                        self.currentUser = nil
                    }
                }
            }
        }
    }

    // MARK: - Login

    func login(username: String, password: String) async {
        isLoading = true
        errorMessage = nil

        do {
            let response = try await APIService.shared.login(username: username, password: password)

            // Store JWT in Keychain
            KeychainService.shared.saveString(response.token, key: "jwt_token")

            currentUser = response.user
            isAuthenticated = true
            isLoading = false
        } catch {
            errorMessage = "Login failed: \(error.localizedDescription)"
            isLoading = false
        }
    }

    // MARK: - Register

    func register(username: String, password: String, displayName: String) async {
        isLoading = true
        errorMessage = nil

        do {
            // Generate ECDH P-384 key pair for this user
            let privateKey = P384.KeyAgreement.PrivateKey()
            let publicKeyData = privateKey.publicKey.rawRepresentation

            let response = try await APIService.shared.register(
                username: username,
                password: password,
                displayName: displayName,
                publicKey: publicKeyData
            )

            // Store JWT and private key in Keychain
            KeychainService.shared.saveString(response.token, key: "jwt_token")
            KeychainService.shared.saveData(privateKey.withUnsafeBytes { Data($0) }, key: "user_private_key")

            currentUser = response.user
            isAuthenticated = true
            isLoading = false
        } catch {
            errorMessage = "Registration failed: \(error.localizedDescription)"
            isLoading = false
        }
    }

    // MARK: - Logout

    func logout() async {
        isLoading = true

        do {
            try await APIService.shared.logout()

            // Clear Keychain and local state
            KeychainService.shared.deleteString(key: "jwt_token")
            KeychainService.shared.deleteString(key: "user_private_key")

            currentUser = nil
            isAuthenticated = false
            isLoading = false
        } catch {
            errorMessage = "Logout failed: \(error.localizedDescription)"
            isLoading = false
        }
    }
}
