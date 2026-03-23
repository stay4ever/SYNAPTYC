import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var auth: AuthViewModel
    @State private var showLogoutConfirm     = false
    @State private var showChangePassword    = false
    @State private var screenshotDetected    = false
    @State private var notificationsEnabled  = true
    @State private var showInviteSheet       = false
    @StateObject private var groupsVM        = GroupsViewModel()

    var body: some View {
        NavigationStack {
            ZStack {
                Color.deepBlack.ignoresSafeArea()
                ScanlineOverlay()

                ScrollView {
                    VStack(spacing: 20) {
                        // Profile card
                        if let user = auth.currentUser {
                            profileCard(user)
                        }

                        // Security section
                        settingsSection(title: "SECURITY") {
                            settingsRow(icon: "lock.shield.fill", label: "Encryption", value: "Signal Double Ratchet")
                            Divider().background(Color.neonGreen.opacity(0.08))
                            settingsRow(icon: "key.fill", label: "Keys", value: "Stored in Keychain")
                            Divider().background(Color.neonGreen.opacity(0.08))
                            settingsRow(icon: "eye.slash.fill", label: "Screen Security", value: "Auto-blur enabled")
                        }

                        // Notifications
                        settingsSection(title: "NOTIFICATIONS") {
                            HStack {
                                Image(systemName: "bell.fill").foregroundColor(.matrixGreen)
                                    .frame(width: 22)
                                Text("Push Notifications").font(.monoBody).foregroundColor(.neonGreen)
                                Spacer()
                                Toggle("", isOn: $notificationsEnabled)
                                    .tint(.neonGreen)
                                    .labelsHidden()
                            }
                            .padding(.vertical, 4)
                        }

                        // Account
                        settingsSection(title: "ACCOUNT") {
                            Button { showChangePassword = true } label: {
                                HStack {
                                    Image(systemName: "key.horizontal.fill").foregroundColor(.matrixGreen).frame(width: 22)
                                    Text("Change Password").font(.monoBody).foregroundColor(.neonGreen)
                                    Spacer()
                                    Image(systemName: "chevron.right").foregroundColor(.matrixGreen.opacity(0.5)).font(.system(size: 12))
                                }
                                .padding(.vertical, 4)
                            }
                            Divider().background(Color.neonGreen.opacity(0.08))
                            Button { showInviteSheet = true } label: {
                                HStack {
                                    Image(systemName: "envelope.fill").foregroundColor(.matrixGreen).frame(width: 22)
                                    Text("Invite Someone").font(.monoBody).foregroundColor(.neonGreen)
                                    Spacer()
                                    Image(systemName: "chevron.right").foregroundColor(.matrixGreen.opacity(0.5)).font(.system(size: 12))
                                }
                                .padding(.vertical, 4)
                            }
                        }

                        // About
                        settingsSection(title: "ABOUT") {
                            settingsRow(icon: "info.circle", label: "Version", value: "\(Config.App.version) (\(Config.App.build))")
                            Divider().background(Color.neonGreen.opacity(0.08))
                            settingsRow(icon: "server.rack", label: "Backend", value: Config.App.backendHost)
                        }

                        // Logout
                        NeonButton("SIGN OUT", icon: "rectangle.portrait.and.arrow.right",
                                   style: .danger) {
                            showLogoutConfirm = true
                        }
                        .padding(.horizontal, 16)
                        .padding(.top, 8)

                        Text("SYNAPTYC · Encrypted by default, private by design.")
                            .font(.monoSmall)
                            .foregroundColor(.matrixGreen.opacity(0.4))
                            .multilineTextAlignment(.center)
                            .padding(.bottom, 30)
                    }
                    .padding(.top, 16)
                }
            }
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Text("SETTINGS").font(.monoHeadline).foregroundColor(.neonGreen).glowText()
                }
            }
        }
        .sheet(isPresented: $showInviteSheet) {
            InviteSheet(vm: groupsVM)
        }
        .alert("Sign Out?", isPresented: $showLogoutConfirm) {
            Button("Sign Out", role: .destructive) { auth.logout() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Your encryption keys remain stored on this device.")
        }
        .sheet(isPresented: $showChangePassword) { ChangePasswordSheet() }
    }

    private func profileCard(_ user: AppUser) -> some View {
        VStack(spacing: 12) {
            ZStack {
                Circle().fill(Color.darkGreen).frame(width: 72, height: 72)
                    .overlay(Circle().stroke(Color.neonGreen.opacity(0.4), lineWidth: 1.5))
                Text(user.initials)
                    .font(.system(size: 26, weight: .bold, design: .monospaced))
                    .foregroundColor(.neonGreen)
            }
            .accessibilityLabel("\(user.name)'s avatar")
            Text(user.name).font(.monoHeadline).foregroundColor(.neonGreen).glowText()
            Text("@\(user.username)").font(.monoCaption).foregroundColor(.matrixGreen)
            Text(user.email).font(.monoCaption).foregroundColor(.matrixGreen.opacity(0.6))
            EncryptionBadge()
        }
        .frame(maxWidth: .infinity)
        .padding(20)
        .neonCard()
        .padding(.horizontal, 16)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Profile: \(user.name), @\(user.username), \(user.email)")
    }

    private func settingsSection<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(title).font(.monoSmall).foregroundColor(.matrixGreen).tracking(2)
                .padding(.horizontal, 16).padding(.bottom, 8)
            VStack(spacing: 0) { content() }
                .padding(.horizontal, 16).padding(.vertical, 10)
                .neonCard()
                .padding(.horizontal, 16)
        }
    }

    private func settingsRow(icon: String, label: String, value: String) -> some View {
        HStack {
            Image(systemName: icon).foregroundColor(.matrixGreen).frame(width: 22)
            Text(label).font(.monoBody).foregroundColor(.neonGreen)
            Spacer()
            Text(value).font(.monoCaption).foregroundColor(.matrixGreen.opacity(0.7)).lineLimit(1)
        }
        .padding(.vertical, 4)
    }
}

struct ChangePasswordSheet: View {
    @Environment(\.dismiss) var dismiss
    @State private var current   = ""
    @State private var newPass   = ""
    @State private var confirm   = ""
    @State private var message   = ""
    @State private var isLoading = false

    var body: some View {
        ZStack {
            Color.deepBlack.ignoresSafeArea()
            VStack(spacing: 16) {
                Text("CHANGE PASSWORD").font(.monoHeadline).foregroundColor(.neonGreen)
                NeonTextField(placeholder: "Current password", text: $current, isSecure: true, icon: "key")
                NeonTextField(placeholder: "New password", text: $newPass, isSecure: true, icon: "key.fill")
                NeonTextField(placeholder: "Confirm new password", text: $confirm, isSecure: true, icon: "key.fill")
                if !message.isEmpty {
                    Text(message).font(.monoCaption).foregroundColor(.neonGreen).multilineTextAlignment(.center)
                }
                NeonButton("UPDATE PASSWORD", isLoading: isLoading) {
                    guard newPass == confirm, newPass.count >= 8 else {
                        message = "⚠ Passwords must match and be at least 8 characters."
                        return
                    }
                    message = "Password change requires re-authentication via the web portal."
                }
                NeonButton("CANCEL", style: .secondary) { dismiss() }
            }
            .padding(24)
        }
        .presentationDetents([.medium])
    }
}
