import SwiftUI

struct LoginView: View {
    @StateObject private var viewModel = AuthViewModel()
    @State private var showPassword = false
    @FocusState private var focusedField: Field?

    enum Field {
        case username
        case password
    }

    var body: some View {
        ZStack {
            Color(red: 0.0, green: 0.055, blue: 0.0)
                .ignoresSafeArea()

            VStack(spacing: 24) {
                // Header
                VStack(spacing: 8) {
                    Text("NANO-SYNAPSYS")
                        .font(.system(size: 32, weight: .bold, design: .monospaced))
                        .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255))
                        .glowText()

                    Text("SECURE LOGIN")
                        .font(.system(size: 12, weight: .medium, design: .monospaced))
                        .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.6))
                        .letterSpacing(1)
                }
                .padding(.top, 40)
                .padding(.bottom, 20)

                Spacer()

                VStack(spacing: 16) {
                    // Username field
                    NeonTextField(
                        placeholder: "USERNAME",
                        text: $viewModel.username,
                        isSecure: false
                    )
                    .focused($focusedField, equals: .username)

                    // Password field with toggle
                    HStack {
                        if showPassword {
                            TextField("PASSWORD", text: $viewModel.password)
                                .font(.system(.body, design: .monospaced))
                                .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255))
                                .focused($focusedField, equals: .password)
                        } else {
                            SecureField("PASSWORD", text: $viewModel.password)
                                .font(.system(.body, design: .monospaced))
                                .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255))
                                .focused($focusedField, equals: .password)
                        }

                        Button(action: { showPassword.toggle() }) {
                            Image(systemName: showPassword ? "eye.slash.fill" : "eye.fill")
                                .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.7))
                                .font(.system(size: 14, weight: .semibold))
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 12)
                    .background(Color(red: 0.04, green: 0.1, blue: 0.04))
                    .border(Color(red: 0.0, green: 1.0, blue: 0.255), width: 1)
                    .cornerRadius(4)

                    // Error message
                    if !viewModel.errorMessage.isEmpty {
                        Text(viewModel.errorMessage)
                            .font(.system(size: 12, weight: .medium, design: .monospaced))
                            .foregroundColor(Color(red: 1.0, green: 0.2, blue: 0.2))
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .padding(.horizontal, 20)

                Spacer()

                // Login button
                NeonButton(
                    title: viewModel.isLoading ? "AUTHENTICATING..." : "LOGIN",
                    isLoading: viewModel.isLoading,
                    action: {
                        viewModel.login()
                    }
                )
                .padding(.horizontal, 20)
                .disabled(viewModel.isLoading)

                // Register link
                HStack(spacing: 4) {
                    Text("NO ACCOUNT?")
                        .font(.system(size: 12, weight: .regular, design: .monospaced))
                        .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.6))

                    NavigationLink(destination: RegisterView()) {
                        Text("REGISTER")
                            .font(.system(size: 12, weight: .bold, design: .monospaced))
                            .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255))
                    }
                }
                .padding(.bottom, 40)
            }
        }
        .navigationBarBackButtonHidden(true)
    }
}

#Preview {
    NavigationStack {
        LoginView()
    }
}
