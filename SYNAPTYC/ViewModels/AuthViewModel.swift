import Foundation
import SwiftUI
import LocalAuthentication

@MainActor
final class AuthViewModel: ObservableObject {
    @Published var isLoggedIn       = false
    @Published var requiresBiometric = false
    @Published var currentUser: AppUser?
    @Published var isLoading        = false
    @Published var errorMessage: String?
    private var biometricsEnabled: Bool { UserDefaults.standard.bool(forKey: "biometrics_enabled") }

    static let shared = AuthViewModel()
    private init() { tryRestore() }

    // MARK: - Session restore

    func tryRestore() {
        guard let token = KeychainService.load(Config.Keychain.tokenKey),
              !token.isEmpty else { return }
        if let data = KeychainService.loadData(Config.Keychain.userKey),
           let user = try? JSONDecoder().decode(AppUser.self, from: data) {
            currentUser = user
            if biometricsEnabled {
                requiresBiometric = true   // gate behind biometrics
            } else {
                isLoggedIn = true
                WebSocketService.shared.connect()
            }
        }
        Task { await refreshUser() }
    }

    // MARK: - Biometric authentication

    func authenticateWithBiometrics() async {
        let context = LAContext()
        var nsError: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &nsError) else {
            // Hardware not available — skip biometric gate
            requiresBiometric = false
            isLoggedIn = currentUser != nil
            if isLoggedIn { WebSocketService.shared.connect() }
            return
        }
        do {
            let ok = try await context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: "Authenticate to access SYNAPTYC"
            )
            if ok {
                requiresBiometric = false
                isLoggedIn        = true
                WebSocketService.shared.connect()
            }
        } catch {
            // User cancelled or failed — stay on biometric screen
        }
    }

    func usePasswordInstead() {
        requiresBiometric = false
        currentUser = nil
        isLoggedIn  = false
    }

    private func refreshUser() async {
        do {
            let user = try await APIService.shared.me()
            currentUser = user
            isLoggedIn  = true
            persist(user: user)
        } catch APIError.unauthorized {
            logout()
        } catch {}
    }

    // MARK: - Login

    func login(email: String, password: String) async {
        isLoading = true; errorMessage = nil
        defer { isLoading = false }
        do {
            let resp = try await APIService.shared.login(email: email, password: password)
            KeychainService.save(resp.token, for: Config.Keychain.tokenKey)
            persist(user: resp.user)
            currentUser = resp.user
            isLoggedIn  = true
            WebSocketService.shared.connect()
            _ = await NotificationService.requestPermission()
            // Sync contacts in background (doesn't block login)
            await ContactSyncService.shared.syncIfAuthorized()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Register

    func register(username: String, email: String, password: String,
                  displayName: String, phoneNumber: String = "") async {
        isLoading = true; errorMessage = nil
        defer { isLoading = false }
        let phoneHash = phoneNumber.isEmpty ? nil : ContactSyncService.hash(phoneNumber: phoneNumber)
        do {
            let resp = try await APIService.shared.register(username: username, email: email,
                                                             password: password, displayName: displayName,
                                                             phoneNumberHash: phoneHash)
            KeychainService.save(resp.token, for: Config.Keychain.tokenKey)
            persist(user: resp.user)
            currentUser = resp.user
            isLoggedIn  = true
            WebSocketService.shared.connect()
            _ = await NotificationService.requestPermission()
            // Sync contacts in background
            await ContactSyncService.shared.syncIfAuthorized()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Logout

    func logout() {
        WebSocketService.shared.disconnect()
        KeychainService.delete(Config.Keychain.tokenKey)
        KeychainService.delete(Config.Keychain.userKey)
        currentUser = nil
        isLoggedIn  = false
    }

    // MARK: - Password reset

    func requestPasswordReset(email: String) async -> Bool {
        do {
            try await APIService.shared.requestPasswordReset(email: email)
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    // MARK: - Private

    private func persist(user: AppUser) {
        guard let data = try? JSONEncoder().encode(user) else { return }
        KeychainService.saveData(data, for: Config.Keychain.userKey)
    }
}
