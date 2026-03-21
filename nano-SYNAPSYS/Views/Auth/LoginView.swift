import SwiftUI

struct LoginView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @FocusState private var focusedField: Field?
    @State private var showPassword = false

    enum Field { case username, password }

    var body: some View {
        NavigationStack {
            ZStack {
                Color(red: 0.0, green: 0.055, blue: 0.0)
                    .ignoresSafeArea()

                VStack(spacing: 24) {
                    VStack(spacing: 8) {
                        Text("NANO-SYNAPSYS")
                            .font(.system(size: 32, weight: .bold, design: .monospaced))
                            .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255))
                            .shadow(color: Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.6), radius: 8)

                        Text("SECURE LOGIN")
                            .font(.system(size: 12, weight: .medium, design: .monospaced))
                            .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.6))
                            .tracking(1)
                    }
                    .padding(.top, 40)
                    .padding(.bottom, 20)

                    Spacer()

                    VStack(spacing: 16) {
                        NeonTextField(placeholder: "USERNAME", text: $authViewModel.username, isSecure: false)
                            .focused($focusedField, equals: .username)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()

                        NeonTextField(placeholder: "PASSWORD", text: $authViewModel.password, isSecure: !showPassword)

                        if !authViewModel.errorMessage.isEmpty {
                            Text(authViewModel.errorMessage)
                                .font(.system(size: 12, weight: .medium, design: .monospaced))
                                .foregroundColor(Color(red: 1.0, green: 0.2, blue: 0.2))
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                    .padding(.horizontal, 20)

                    Spacer()

                    NeonButton(
                        title: authViewModel.isLoading ? "AUTHENTICATING..." : "LOGIN",
                        isLoading: authViewModel.isLoading,
                        action: { authViewModel.login() }
                    )
                    .padding(.horizontal, 20)
                    .disabled(authViewModel.isLoading)

                    HStack(spacing: 4) {
                        Text("NO ACCOUNT?")
                            .font(.system(size: 12, weight: .regular, design: .monospaced))
                            .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.6))

                        NavigationLink(destination: RegisterView().environmentObject(authViewModel)) {
                            Text("REGISTER")
                                .font(.system(size: 12, weight: .bold, design: .monospaced))
                                .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255))
                        }
                    }
                    .padding(.bottom, 40)
                }
            }
        }
    }
}

#Preview {
    LoginView()
        .environmentObject(AuthViewModel())
}
