import SwiftUI

// MARK: - Theme definitions

enum AppTheme: String, CaseIterable, Identifiable {
    case matrixGreen   = "Matrix Green"
    case tacticalBlack = "Tactical Black"

    var id: String { rawValue }

    /// Preview swatch color shown in the picker
    var swatchColor: Color {
        switch self {
        case .matrixGreen:   return Color(hex: "#00ff41")
        case .tacticalBlack: return Color(hex: "#D4D4D4")
        }
    }

    var iconName: String {
        switch self {
        case .matrixGreen:   return "terminal"
        case .tacticalBlack: return "shield.fill"
        }
    }
}

// MARK: - Theme manager

final class ThemeManager: ObservableObject {
    static let shared = ThemeManager()

    @AppStorage("app_theme") var activeTheme: AppTheme = .matrixGreen {
        didSet { objectWillChange.send() }
    }

    private init() {}
}
