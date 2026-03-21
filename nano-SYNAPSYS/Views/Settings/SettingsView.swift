import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var viewModel: AuthViewModel
    @State private var notificationsEnabled = true
    @State private var showLogoutAlert = false

    let appVersion = "1.1.0"
    let buildNumber = "13"

    var body: some View {
        ZStack {
            Color(red: 0.0, green: 0.055, blue: 0.0)
                .ignoresSafeArea()

            ScrollView {
                VStack(spacing: 20) {
                    VStack(spacing: 8) {
                        Text("SETTINGS")
                            .font(.system(size: 28, weight: .bold, design: .monospaced))
                            .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255))

                        Text("SECURITY & PREFERENCES")
                            .font(.system(size: 12, weight: .regular, design: .monospaced))
                            .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.6))
                            .tracking(1)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 16)
                    .padding(.top, 16)

                    // Account Section
                    VStack(spacing: 12) {
                        settingSectionHeader("ACCOUNT")

                        VStack(spacing: 12) {
                            settingRow(label: "USERNAME", value: viewModel.currentUser?.username ?? "—")
                            settingRow(label: "DISPLAY NAME", value: viewModel.currentUser?.displayNameOrUsername ?? "—")
                            settingRow(label: "USER ID", value: viewModel.currentUser?.id ?? "—")
                        }
                        .padding(.horizontal, 16)
                    }

                    // Security Section
                    VStack(spacing: 12) {
                        settingSectionHeader("SECURITY")

                        VStack(spacing: 12) {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("ENCRYPTION STATUS")
                                    .font(.system(size: 12, weight: .bold, design: .monospaced))
                                    .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.7))

                                HStack(spacing: 8) {
                                    Image(systemName: "lock.fill")
                                        .font(.system(size: 16, weight: .semibold))
                                        .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255))
                                    Text("E2E ENCRYPTED (AES-256-GCM)")
                                        .font(.system(size: 13, weight: .regular, design: .monospaced))
                                        .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.8))
                                    Spacer()
                                }
                                .padding(12)
                                .background(Color(red: 0.0, green: 0.1, blue: 0.0))
                                .overlay(RoundedRectangle(cornerRadius: 4).stroke(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.3), lineWidth: 1))
                            }

                            settingRow(label: "KEY EXCHANGE", value: "ECDH P-384")
                        }
                        .padding(.horizontal, 16)
                    }

                    // Notifications
                    VStack(spacing: 12) {
                        settingSectionHeader("NOTIFICATIONS")

                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("PUSH NOTIFICATIONS")
                                    .font(.system(size: 17, weight: .semibold, design: .monospaced))
                                    .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255))
                                Text("Receive real-time message alerts")
                                    .font(.system(.caption, design: .monospaced))
                                    .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.6))
                            }
                            Spacer()
                            Toggle("", isOn: $notificationsEnabled)
                                .tint(Color(red: 0.0, green: 1.0, blue: 0.255))
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                    }

                    // App Info
                    VStack(spacing: 12) {
                        settingSectionHeader("APP INFO")

                        VStack(spacing: 12) {
                            settingRow(label: "VERSION", value: appVersion)
                            settingRow(label: "BUILD", value: buildNumber)
                            settingRow(label: "PLATFORM", value: "iOS 17.0+")
                        }
                        .padding(.horizontal, 16)
                    }

                    // Logout
                    Button(action: { showLogoutAlert = true }) {
                        HStack(spacing: 8) {
                            Image(systemName: "arrow.left.circle.fill")
                                .font(.system(size: 16, weight: .semibold))
                            Text("LOGOUT")
                                .font(.system(size: 17, weight: .semibold, design: .monospaced))
                            Spacer()
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .padding(.horizontal, 16)
                        .foregroundColor(Color(red: 0.0, green: 0.055, blue: 0.0))
                        .background(Color(red: 1.0, green: 0.2, blue: 0.2))
                        .cornerRadius(4)
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 20)
                }
            }
        }
        .alert("LOGOUT", isPresented: $showLogoutAlert) {
            Button("CANCEL", role: .cancel) { }
            Button("LOGOUT", role: .destructive) { viewModel.logout() }
        } message: {
            Text("Are you sure you want to logout? Your encryption keys will be removed from this device.")
        }
    }

    private func settingSectionHeader(_ title: String) -> some View {
        Text(title)
            .font(.system(size: 12, weight: .bold, design: .monospaced))
            .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.7))
            .tracking(1)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16)
            .padding(.top, 8)
    }

    private func settingRow(label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.system(size: 11, weight: .bold, design: .monospaced))
                .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.6))
            Text(value)
                .font(.system(.body, design: .monospaced))
                .foregroundColor(Color(red: 0.0, green: 1.0, blue: 0.255))
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 10)
        .padding(.horizontal, 12)
        .background(Color(red: 0.0, green: 0.1, blue: 0.0))
        .overlay(RoundedRectangle(cornerRadius: 4).stroke(Color(red: 0.0, green: 1.0, blue: 0.255).opacity(0.2), lineWidth: 1))
    }
}

#Preview {
    SettingsView()
        .environmentObject(AuthViewModel())
}
