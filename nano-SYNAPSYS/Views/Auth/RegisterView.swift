import SwiftUI

struct RegisterView: View {
    @EnvironmentObject var viewModel: AuthViewModel
    @Environment(\.dismiss) var dismiss

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
                    Color.clear.frame(width: 44)
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 12)

                ScrollView {
                    VStack(spacing: 16) {
                        NeonTextField(placeholder: "USERNAME", text: $viewModel.username, isSecure: false)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()

                        NeonTextField(placeholder: "DISPLAY NAME (OPTIONAL)", text: $viewModel.displayName, isSecure: false)

                        NeonTextField(placeholder: "PASSWORD", text: $viewModel.password, isSecure: true)

                        NeonTextField(placeholder: "CONFIRM PASSWORD", text: $viewModel.confirmPassword, isSecure: true)

                        if !viewModel.confirmPassword.isEmpty {
                            HStack(spacing: 6) {
                                Image(systemName: passwordsMatch ? "checkmark.circle.fill" : "xmark.circle.fill")
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundColor(passwordsMatch
                                        ? Color(red: 0.0, green: 1.0, blue: 0.255)
                                        : Color(red: 1.0, green: 0.2, blue: 0.2))

                                Text(passwordsMatch ? "PASSWORDS MATCH" : "PASSWORDS DO NOT MATCH")
                                    .font(.system(size: 12, weight: .medium, design: .monospaced))
                                    .foregroundColor(passwordsMatch
                                        ? Color(red: 0.0, green: 1.0, blue: 0.255)
                                        : Color(red: 1.0, green: 0.2, blue: 0.2))
                                Spacer()
                            }
                        }

                        if !viewModel.errorMessage.isEmpty {
                            Text(viewModel.errorMessage)
                                .font(.system(size: 12, weight: .medium, design: .monospaced))
                                .foregroundColor(Color(red: 1.0, green: 0.2, blue: 0.2))
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 24)
                }

                NeonButton(
                    title: viewModel.isLoading ? "REGISTERING..." : "CREATE ACCOUNT",
                    isLoading: viewModel.isLoading,
                    action: { viewModel.register() }
                )
                .padding(.horizontal, 20)
                .padding(.bottom, 20)
                .disabled(!isFormValid || viewModel.isLoading)
            }
        }
        .navigationBarBackButtonHidden(true)
    }
}

#Preview {
    NavigationStack {
        RegisterView()
            .environmentObject(AuthViewModel())
    }
}
