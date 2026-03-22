import SwiftUI

struct RegisterView: View {
    @EnvironmentObject var auth: AuthViewModel
    @Environment(\.dismiss) var dismiss

    @State private var username    = ""
    @State private var displayName = ""
    @State private var email       = ""
    @State private var password    = ""
    @State private var confirm     = ""
    @State private var submitted   = false

    var passwordsMatch: Bool { password == confirm && !password.isEmpty }

    var body: some View {
        ZStack {
            Color.deepBlack.ignoresSafeArea()
            ScanlineOverlay()

            ScrollView {
                VStack(spacing: 24) {
                    // Header
                    VStack(spacing: 8) {
                        Image(systemName: "person.badge.shield.checkmark.fill")
                            .font(.system(size: 40))
                            .foregroundColor(.neonGreen)
                            .shadow(color: .neonGreen, radius: 10)
                        Text("JOIN THE EVOLUTION")
                            .font(.monoTitle)
                            .foregroundColor(.neonGreen)
                            .glowText()
                        Text("Your account requires admin approval.")
                            .font(.monoCaption)
                            .foregroundColor(.matrixGreen)
                    }
                    .padding(.top, 40)

                    if submitted {
                        VStack(spacing: 16) {
                            Image(systemName: "clock.badge.checkmark.fill")
                                .font(.system(size: 50))
                                .foregroundColor(.neonGreen)
                            Text("Registration submitted.\nAwaiting administrator approval.")
                                .font(.monoBody)
                                .foregroundColor(.matrixGreen)
                                .multilineTextAlignment(.center)
                            NeonButton("BACK TO LOGIN", style: .secondary) { dismiss() }
                        }
                        .padding(.horizontal, 28)
                    } else {
                        VStack(spacing: 12) {
                            NeonTextField(placeholder: "Username", text: $username, icon: "at")
                            NeonTextField(placeholder: "Display name", text: $displayName,
                                          icon: "person", autocapitalization: .words)
                            NeonTextField(placeholder: "Email address", text: $email,
                                          icon: "envelope", keyboardType: .emailAddress)
                            NeonTextField(placeholder: "Password (min 8 chars)", text: $password,
                                          isSecure: true, icon: "key")
                            NeonTextField(placeholder: "Confirm password", text: $confirm,
                                          isSecure: true, icon: "key.fill")

                            if !confirm.isEmpty && !passwordsMatch {
                                Text("⚠ Passwords do not match")
                                    .font(.monoCaption)
                                    .foregroundColor(.alertRed)
                            }
                            if let err = auth.errorMessage {
                                Text("⚠ \(err)")
                                    .font(.monoCaption)
                                    .foregroundColor(.alertRed)
                                    .multilineTextAlignment(.center)
                            }

                            NeonButton("REGISTER", icon: "arrow.right.circle.fill",
                                       isLoading: auth.isLoading) {
                                guard passwordsMatch else { return }
                                Task {
                                    await auth.register(username: username, email: email,
                                                         password: password, displayName: displayName)
                                    if auth.errorMessage == nil { submitted = true }
                                }
                            }
                            .disabled(!passwordsMatch)

                            NeonButton("CANCEL", style: .secondary) { dismiss() }
                        }
                        .padding(.horizontal, 28)
                    }

                    Spacer(minLength: 40)
                }
            }
        }
    }
}
