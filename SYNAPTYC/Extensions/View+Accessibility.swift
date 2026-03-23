import SwiftUI
import UIKit

// MARK: - Accessibility helpers

extension View {
    /// Adds a standard accessibility label and hint for interactive elements
    func accessibleButton(label: String, hint: String? = nil) -> some View {
        self
            .accessibilityLabel(label)
            .accessibilityAddTraits(.isButton)
            .accessibilityHint(hint.map { Text($0) } ?? Text(""))
    }

    /// Adds accessibility label for static content
    func accessibleElement(label: String, isHeader: Bool = false) -> some View {
        var view = self.accessibilityLabel(label)
        if isHeader {
            return AnyView(view.accessibilityAddTraits(.isHeader))
        }
        return AnyView(view)
    }
}

// MARK: - UIImage resize helper

extension UIImage {
    /// Returns a square-cropped and resized copy of the image.
    func resized(to size: CGSize) -> UIImage? {
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { _ in
            // Center-crop to square before scaling
            let srcSize = self.size
            let side    = min(srcSize.width, srcSize.height)
            let origin  = CGPoint(x: (srcSize.width - side) / 2, y: (srcSize.height - side) / 2)
            let cropRect = CGRect(origin: origin, size: CGSize(width: side, height: side))
            guard let cropped = self.cgImage?.cropping(to: cropRect) else {
                self.draw(in: CGRect(origin: .zero, size: size))
                return
            }
            UIImage(cgImage: cropped).draw(in: CGRect(origin: .zero, size: size))
        }
    }
}
