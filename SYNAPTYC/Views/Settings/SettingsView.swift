import SwiftUI
import PhotosUI
import UIKit

struct SettingsView: View {
    @EnvironmentObject var auth: AuthViewModel
    @EnvironmentObject var themeManager: ThemeManager
    @AppStorage("biometrics_enabled") private var biometricsEnabled = false
    @AppStorage("banner_enabled")    private var bannerEnabled     = false
    @State private var showLogoutConfirm     = false
    @State private var showChangePassword    = false
    @State private var screenshotDetected    = false
    @State private var notificationsEnabled  = true
    @State private var showInviteSheet       = false
    @State private var showBannerChat        = false
    @StateObject private var groupsVM        = GroupsViewModel()
    @State private var avatarItem: PhotosPickerItem?
    @State private var avatarUploading       = false
    @State private var localAvatarImage: UIImage?
    @State private var avatarError: String?

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

                        // Appearance / Theme
                        settingsSection(title: "APPEARANCE") {
                            VStack(spacing: 10) {
                                HStack {
                                    Image(systemName: "paintpalette.fill")
                                        .foregroundColor(.matrixGreen).frame(width: 22)
                                    Text("Theme").font(.monoBody).foregroundColor(.neonGreen)
                                    Spacer()
                                }
                                HStack(spacing: 8) {
                                    ForEach(AppTheme.allCases) { skin in
                                        Button {
                                            withAnimation(.easeInOut(duration: 0.25)) {
                                                themeManager.activeTheme = skin
                                            }
                                        } label: {
                                            HStack(spacing: 6) {
                                                Circle()
                                                    .fill(skin.swatchColor)
                                                    .frame(width: 9, height: 9)
                                                    .shadow(color: skin.swatchColor.opacity(0.7), radius: 3)
                                                Text(skin.rawValue)
                                                    .font(.monoCaption)
                                                    .foregroundColor(
                                                        themeManager.activeTheme == skin
                                                            ? .neonGreen : .matrixGreen
                                                    )
                                            }
                                            .frame(maxWidth: .infinity)
                                            .padding(.vertical, 9)
                                            .background(
                                                RoundedRectangle(cornerRadius: 7)
                                                    .fill(
                                                        themeManager.activeTheme == skin
                                                            ? Color.neonGreen.opacity(0.1)
                                                            : Color.clear
                                                    )
                                                    .overlay(
                                                        RoundedRectangle(cornerRadius: 7)
                                                            .stroke(
                                                                themeManager.activeTheme == skin
                                                                    ? Color.neonGreen.opacity(0.5)
                                                                    : Color.borderGreen,
                                                                lineWidth: 1
                                                            )
                                                    )
                                            )
                                        }
                                    }
                                }
                            }
                            .padding(.vertical, 4)
                        }

                        // Biometrics
                        settingsSection(title: "BIOMETRICS") {
                            HStack {
                                Image(systemName: "faceid")
                                    .foregroundColor(.matrixGreen).frame(width: 22)
                                Text("Face ID / Touch ID").font(.monoBody).foregroundColor(.neonGreen)
                                Spacer()
                                Toggle("", isOn: $biometricsEnabled)
                                    .tint(.neonGreen)
                                    .labelsHidden()
                            }
                            .padding(.vertical, 4)
                        }

                        // Banner AI
                        settingsSection(title: "BANNER AI") {
                            VStack(spacing: 10) {
                                HStack {
                                    Image(systemName: "cpu.fill")
                                        .foregroundColor(.matrixGreen).frame(width: 22)
                                    Text("Enable Banner").font(.monoBody).foregroundColor(.neonGreen)
                                    Spacer()
                                    Toggle("", isOn: $bannerEnabled)
                                        .tint(.neonGreen)
                                        .labelsHidden()
                                }
                                .padding(.vertical, 4)

                                if bannerEnabled {
                                    Divider().background(Color.neonGreen.opacity(0.08))
                                    Button { showBannerChat = true } label: {
                                        HStack {
                                            Image(systemName: "bubble.left.and.bubble.right.fill")
                                                .foregroundColor(.matrixGreen).frame(width: 22)
                                            Text("Open Banner").font(.monoBody).foregroundColor(.neonGreen)
                                            Spacer()
                                            Image(systemName: "chevron.right")
                                                .foregroundColor(.matrixGreen.opacity(0.5))
                                                .font(.system(size: 12))
                                        }
                                        .padding(.vertical, 4)
                                    }
                                }
                            }
                        }

                        // Security section
                        settingsSection(title: "SECURITY") {
                            settingsRow(icon: "lock.shield.fill", label: "Encryption", value: "End-to-end")
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
        .sheet(isPresented: $showBannerChat) {
            BotChatView()
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
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
            PhotosPicker(selection: $avatarItem, matching: .images, photoLibrary: .shared()) {
                ZStack(alignment: .bottomTrailing) {
                    // Local preview takes priority; then server URL; then initials
                    if let local = localAvatarImage {
                        Image(uiImage: local)
                            .resizable().scaledToFill()
                            .frame(width: 72, height: 72).clipShape(Circle())
                            .overlay(Circle().stroke(Color.neonGreen.opacity(0.4), lineWidth: 1.5))
                    } else if let urlStr = user.avatarURL,
                              let url = resolvedURL(urlStr) {
                        AsyncImage(url: url) { phase in
                            switch phase {
                            case .success(let img):
                                img.resizable().scaledToFill()
                                    .frame(width: 72, height: 72).clipShape(Circle())
                                    .overlay(Circle().stroke(Color.neonGreen.opacity(0.4), lineWidth: 1.5))
                            default:
                                initialsCircle(user)
                            }
                        }
                        .id(urlStr)  // force reload when URL changes
                    } else {
                        initialsCircle(user)
                    }
                    // Edit badge
                    ZStack {
                        Circle().fill(Color.neonGreen).frame(width: 20, height: 20)
                        Image(systemName: avatarUploading ? "arrow.triangle.2.circlepath" : "camera.fill")
                            .font(.system(size: 10)).foregroundColor(.deepBlack)
                    }
                    .offset(x: 2, y: 2)
                }
            }
            .accessibilityLabel("Tap to change avatar")
            .onChange(of: avatarItem) { _, item in
                guard let item else { return }
                Task { await uploadAvatar(item) }
            }
            if let err = avatarError {
                Text(err).font(.monoCaption).foregroundColor(.alertRed)
                    .multilineTextAlignment(.center).padding(.horizontal, 8)
            }

            Text(user.name).font(.monoHeadline).foregroundColor(.neonGreen).glowText()
            Text("@\(user.username)").font(.monoCaption).foregroundColor(.matrixGreen)
            Text(user.email).font(.monoCaption).foregroundColor(.matrixGreen.opacity(0.6))
        }
        .frame(maxWidth: .infinity)
        .padding(20)
        .neonCard()
        .padding(.horizontal, 16)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Profile: \(user.name), @\(user.username), \(user.email)")
    }

    private func initialsCircle(_ user: AppUser) -> some View {
        ZStack {
            Circle().fill(Color.darkGreen).frame(width: 72, height: 72)
                .overlay(Circle().stroke(Color.neonGreen.opacity(0.4), lineWidth: 1.5))
            Text(user.initials)
                .font(.system(size: 26, weight: .bold, design: .monospaced))
                .foregroundColor(.neonGreen)
        }
    }

    private func resolvedURL(_ urlStr: String) -> URL? {
        if urlStr.hasPrefix("http") { return URL(string: urlStr) }
        // Relative path — prepend base URL
        return URL(string: Config.baseURL + urlStr)
    }

    private func uploadAvatar(_ item: PhotosPickerItem) async {
        avatarError = nil
        guard let data = try? await item.loadTransferable(type: Data.self) else { return }
        guard let uiImage = UIImage(data: data),
              let resized = uiImage.resized(to: CGSize(width: 200, height: 200)),
              let jpeg = resized.jpegData(compressionQuality: 0.7) else { return }

        // Show local preview immediately so the user sees feedback right away
        localAvatarImage = UIImage(data: jpeg)

        avatarUploading = true
        defer { avatarUploading = false; avatarItem = nil }
        do {
            let updatedUser = try await APIService.shared.uploadAvatar(jpegData: jpeg)
            auth.updateCurrentUser(updatedUser)
            // Keep local image until server URL is confirmed loaded
        } catch {
            avatarError = "Upload failed: \(error.localizedDescription)"
            // Revert local preview on failure
            localAvatarImage = nil
        }
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
