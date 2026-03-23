import SwiftUI

struct LoginView: View {
    @EnvironmentObject var auth: AuthViewModel
    @State private var email        = ""
    @State private var password     = ""
    @State private var showRegister = false
    @State private var showForgot   = false
    @State private var forgotEmail  = ""
    @State private var forgotSent   = false

    var body: some View {
        ZStack {
            Color.deepBlack.ignoresSafeArea()
            ScanlineOverlay()

            ScrollView {
                VStack(spacing: 32) {
                    // Header
                    VStack(spacing: 10) {
                        Image(systemName: "lock.shield.fill")
                            .font(.system(size: 48))
                            .foregroundColor(.neonGreen)
                            .shadow(color: .neonGreen, radius: 12)
                            .accessibilityHidden(true)

                        Text("SYNAPTYC")
                            .font(.monoTitle)
                            .foregroundColor(.neonGreen)
                            .glowText()
                            .accessibilityAddTraits(.isHeader)

                        Text("SECURE COMMUNICATIONS")
                            .font(.monoSmall)
                            .foregroundColor(.matrixGreen)
                            .tracking(2)

                        EncryptionBadge()
                            .padding(.top, 4)
                    }
                    .padding(.top, 60)

                    // Login form
                    VStack(spacing: 14) {
                        NeonTextField(placeholder: "Email address", text: $email,
                                      icon: "envelope", keyboardType: .emailAddress,
                                      fieldIdentifier: "login_username_field")
                        NeonTextField(placeholder: "Password", text: $password,
                                      isSecure: true, icon: "key",
                                      fieldIdentifier: "login_password_field")

                        if let err = auth.errorMessage {
                            Text("⚠ \(err)")
                                .font(.monoCaption)
                                .foregroundColor(.alertRed)
                                .multilineTextAlignment(.center)
                        }

                        NeonButton("AUTHENTICATE", icon: "arrow.right.circle.fill",
                                   isLoading: auth.isLoading) {
                            Task { await auth.login(email: email, password: password) }
                        }
                        .accessibilityIdentifier("login_button")

                        Button { showForgot = true } label: {
                            Text("Forgot password?")
                                .font(.monoCaption)
                                .foregroundColor(.matrixGreen)
                        }
                    }
                    .padding(.horizontal, 28)

                    // Register
                    VStack(spacing: 10) {
                        Rectangle()
                            .fill(Color.neonGreen.opacity(0.1))
                            .frame(height: 1)

                        NeonButton("CREATE ACCOUNT", icon: "person.badge.plus",
                                   style: .secondary) {
                            showRegister = true
                        }
                        .accessibilityIdentifier("register_link")
                        .padding(.horizontal, 28)

                        Text("Registration requires admin approval.")
                            .font(.monoSmall)
                            .foregroundColor(.matrixGreen.opacity(0.6))
                    }

                    Spacer(minLength: 40)
                }
            }
        }
        .sheet(isPresented: $showRegister) {
            RegisterView()
                .environmentObject(auth)
        }
        .sheet(isPresented: $showForgot) {
            forgotPasswordSheet
        }
    }

    private var forgotPasswordSheet: some View {
        ZStack {
            Color.deepBlack.ignoresSafeArea()
            VStack(spacing: 20) {
                Text("RESET PASSWORD")
                    .font(.monoHeadline)
                    .foregroundColor(.neonGreen)

                if forgotSent {
                    VStack(spacing: 12) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 40))
                            .foregroundColor(.neonGreen)
                        Text("If that email is registered, a reset link has been sent.")
                            .font(.monoBody)
                            .foregroundColor(.matrixGreen)
                            .multilineTextAlignment(.center)
                    }
                } else {
                    NeonTextField(placeholder: "Email address", text: $forgotEmail,
                                  icon: "envelope", keyboardType: .emailAddress)
                    NeonButton("SEND RESET LINK") {
                        Task {
                            forgotSent = await auth.requestPasswordReset(email: forgotEmail)
                        }
                    }
                }
            }
            .padding(28)
        }
        .presentationDetents([.medium])
    }
}
