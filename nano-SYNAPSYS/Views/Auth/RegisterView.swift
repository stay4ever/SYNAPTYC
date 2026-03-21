import SwiftUI

struct RegisterView: View {
    @StateObject private var viewModel = AuthViewModel()
    @Environment(\.dismiss) var dismiss
    @State private var showPassword = false
    @State private var showConfirmPassword = false
    @FocusState private var focusedField: Field?

    enum Field {
        case username
        case displayName
        case password
        case confirmPassword
    }

    var passwordsMatch: Bool {
        viewModel.password == viewModel.confirmPassword && !viewModel.password.isEmpty
    }

    var isFormValid: Bool {
        !viewModel.username.isEmpty && !viewModel.password.isEmpty && passwordsMatch
    }

    var body: some View {
        ZStack {
            Color(red: 0.0, green: 0.055, blue: 0.0)
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Header with back button
                HStack {
                    Button(action: { dismiss() }) {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255))
                    }

                    Spacer()

                    Text("CREATE ACCOUNT")
                        .font(.system(size: 14, weight: .bold, design: .monospaced))
                        .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255))

                    Spacer()

                    Color.clear
                        .frame(width: 44)
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
                .borderBottom(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.2), width: 1)

                ScrollView {
                    VStack(spacing: 16) {
                        // Form fields
                        VStack(spacing: 16) {
                            // Username
                            NeonTextField(
                                placeholder: "USERNAME",
                                text: $viewModel.username,
                                isSecure: false
                            )
                            .focused($focusedField, equals: .username)

                            // Display Name (optional)
                            NeonTextField(
                                placeholder: "DISPLAY NAME (OPTIONAL)",
                                text: $viewModel.displayName,
                                isSecure: false
                            )
                            .focused($focusedField, equals: .displayName)

                            // Password
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

                            // Confirm Password
                            HStack {
                                if showConfirmPassword {
                                    TextField("CONFIRM PASSWORD", text: $viewModel.confirmPassword)
                                        .font(.system(.body, design: .monospaced))
                                        .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255))
                                        .focused($focusedField, equals: .confirmPassword)
                                } else {
                                    SecureField("CONFIRM PASSWORD", text: $viewModel.confirmPassword)
                                        .font(.system(.body, design: .monospaced))
                                        .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255))
                                        .focused($focusedField, equals: .confirmPassword)
                                }

                                Button(action: { showConfirmPassword.toggle() }) {
                                    Image(systemName: showConfirmPassword ? "eye.slash.fill" : "eye.fill")
                                        .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.7))
                                        .font(.system(size: 14, weight: .semibold))
                                }
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 12)
                            .background(Color(red: 0.04, green: 0.1, blue: 0.04))
                            .border(
                                !viewModel.confirmPassword.isEmpty && !passwordsMatch
                                    ? Color(red: 1.0, green: 0.2, blue: 0.2)
                                    : Color(red: 0.0, green: 1.0, blue: 0.255),
                                width: 1
                            )
                            .cornerRadius(4)

                            // Password match indicator
                            if !viewModel.confirmPassword.isEmpty {
                                HStack(spacing: 6) {
                                    Image(systemName: passwordsMatch ? "checkmark.circle.fill" : "xmark.circle.fill")
                                        .font(.system(size: 12, weight: .bold))
                                        .foregroundColor(passwordsMatch ? Color(red: 0.0, green: 1.0, blue: 0.255) : Color(red: 1.0, green: 0.2, blue: 0.2))

                                    Text(passwordsMatch ? "PASSWORDS MATCH" : "PASSWORDS DO NOT MATCH")
                                        .font(.system(size: 12, weight: .medium, design: .monospaced))
                                        .foregroundColor(passwordsMatch ? Color(red: 0.0, green: 1.0, blue: 0.255) : Color(red: 1.0, green: 0.2, blue: 0.2))

                                    Spacer()
                                }
                            }
                        }
                        .padding(.horizontal, 20)
                        .padding(.top, 24)

                        // Error message
                        if !viewModel.errorMessage.isEmpty {
                            Text(viewModel.errorMessage)
                                .font(.system(size: 12, weight: .medium, design: .monospaced))
                                .foregroundColor(Color(red: 1.0, green: 0.2, blue: 0.2))
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.horizontal, 20)
                        }

                        Spacer()
                    }
                }

                // Register button
                NeonButton(
                    title: viewModel.isLoading ? "REGISTERING..." : "CREATE ACCOUNT",
                    isLoading: viewModel.isLoading,
                    action: {
                        viewModel.register()
                    }
                )
                .padding(.horizontal, 20)
                .padding(.bottom, 20)
                .disabled(!isFormValid || viewModel.isLoading)
            }
        }
        .navigationBarBackButtonHidden(true)
    }
}

extension View {
    func borderBottom(_ color: Color, width: CGFloat) -> some View {
        self.border(color, width: width)
    }
}

#Preview {
    NavigationStack {
        RegisterView()
    }
}
