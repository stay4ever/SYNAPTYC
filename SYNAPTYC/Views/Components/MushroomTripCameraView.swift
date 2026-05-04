import SwiftUI
import AVFoundation
import CoreImage
import CoreImage.CIFilterBuiltins
import MetalKit
import Photos
import UIKit

// MARK: - Mushroom Trip Camera
//
// Live camera feed routed through a chain of Core Image filters that animate
// over time to simulate a mushroom-trip-style hallucination. Hue rotation,
// saturation pump, kaleidoscope / twirl / bump / fractal distortions and
// bloom are layered and modulated by an intensity slider.

struct MushroomTripCameraView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var engine = TrippyCameraEngine()
    @State private var capturedImage: UIImage?
    @State private var toastMessage: String?
    @State private var permissionDenied = false

    var body: some View {
        ZStack {
            Color.deepBlack.ignoresSafeArea()

            if permissionDenied {
                permissionPrompt
            } else {
                TrippyMetalPreview(engine: engine)
                    .ignoresSafeArea()
                ScanlineOverlay()
            }

            VStack(spacing: 0) {
                topBar
                Spacer(minLength: 0)
                if let image = capturedImage {
                    capturedReview(image)
                        .padding(.horizontal, 16)
                        .padding(.bottom, 24)
                } else if !permissionDenied {
                    controls
                        .padding(.horizontal, 16)
                        .padding(.bottom, 24)
                }
            }

            if let toast = toastMessage {
                VStack {
                    Spacer()
                    Text(toast)
                        .font(.monoCaption)
                        .foregroundColor(.neonGreen)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(
                            Capsule().fill(Color.darkGreen.opacity(0.9))
                                .overlay(
                                    Capsule().stroke(Color.neonGreen.opacity(0.6), lineWidth: 1)
                                )
                        )
                        .padding(.bottom, 160)
                }
                .transition(.opacity)
                .allowsHitTesting(false)
            }
        }
        .task { await requestCameraThenStart() }
        .onDisappear { engine.stop() }
    }

    // MARK: Subviews

    private var topBar: some View {
        HStack {
            roundIconButton(systemName: "xmark") { dismiss() }
            Spacer()
            Text("MUSHROOM TRIP")
                .font(.monoHeadline)
                .foregroundColor(.neonGreen)
                .glowText()
            Spacer()
            roundIconButton(systemName: "arrow.triangle.2.circlepath.camera.fill") {
                engine.flipCamera()
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 12)
    }

    private func roundIconButton(systemName: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 15, weight: .bold))
                .foregroundColor(.neonGreen)
                .frame(width: 38, height: 38)
                .background(Circle().fill(Color.deepBlack.opacity(0.55)))
                .overlay(Circle().stroke(Color.neonGreen.opacity(0.5), lineWidth: 1))
                .shadow(color: .neonGreen.opacity(0.25), radius: 6)
        }
    }

    private var controls: some View {
        VStack(spacing: 16) {
            HStack(spacing: 12) {
                Image(systemName: "wand.and.stars")
                    .foregroundColor(.matrixGreen)
                Slider(value: $engine.intensity, in: 0...1)
                    .tint(.neonGreen)
                Text(String(format: "%02d%%", Int(engine.intensity * 100)))
                    .font(.monoSmall)
                    .foregroundColor(.matrixGreen)
                    .frame(width: 44, alignment: .trailing)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(
                Capsule().fill(Color.deepBlack.opacity(0.7))
                    .overlay(Capsule().stroke(Color.neonGreen.opacity(0.4), lineWidth: 1))
            )

            HStack(spacing: 16) {
                modePicker
                Spacer()
                shutterButton
                Spacer()
                Color.clear.frame(width: 64, height: 64)
            }
        }
    }

    private var modePicker: some View {
        Menu {
            ForEach(TripMode.allCases) { mode in
                Button {
                    engine.mode = mode
                } label: {
                    Label(mode.title, systemImage: mode.icon)
                }
            }
        } label: {
            VStack(spacing: 4) {
                Image(systemName: engine.mode.icon)
                    .font(.system(size: 18))
                    .foregroundColor(.neonGreen)
                Text(engine.mode.shortLabel)
                    .font(.system(size: 8, design: .monospaced))
                    .foregroundColor(.matrixGreen)
            }
            .frame(width: 64, height: 64)
            .background(
                RoundedRectangle(cornerRadius: 14)
                    .fill(Color.deepBlack.opacity(0.7))
                    .overlay(
                        RoundedRectangle(cornerRadius: 14)
                            .stroke(Color.neonGreen.opacity(0.4), lineWidth: 1)
                    )
            )
        }
    }

    private var shutterButton: some View {
        Button {
            engine.capture { image in
                if let image {
                    capturedImage = image
                } else {
                    showToast("Capture failed")
                }
            }
        } label: {
            ZStack {
                Circle()
                    .stroke(Color.neonGreen, lineWidth: 3)
                    .frame(width: 76, height: 76)
                    .shadow(color: .neonGreen.opacity(0.7), radius: 10)
                Circle()
                    .fill(Color.neonGreen)
                    .frame(width: 60, height: 60)
                Image(systemName: "eye.fill")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundColor(.deepBlack)
            }
        }
    }

    private func capturedReview(_ image: UIImage) -> some View {
        VStack(spacing: 14) {
            Image(uiImage: image)
                .resizable()
                .scaledToFit()
                .frame(maxHeight: 320)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.neonGreen.opacity(0.6), lineWidth: 1)
                )
                .shadow(color: .neonGreen.opacity(0.3), radius: 12)

            HStack(spacing: 12) {
                Button { capturedImage = nil } label: {
                    Label("DISCARD", systemImage: "xmark")
                        .font(.monoCaption)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .foregroundColor(.alertRed)
                        .background(
                            RoundedRectangle(cornerRadius: 10)
                                .stroke(Color.alertRed.opacity(0.6), lineWidth: 1)
                        )
                }
                Button { saveToLibrary(image) } label: {
                    Label("SAVE", systemImage: "square.and.arrow.down")
                        .font(.monoCaption)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .foregroundColor(.deepBlack)
                        .background(
                            RoundedRectangle(cornerRadius: 10)
                                .fill(Color.neonGreen)
                        )
                }
            }
        }
    }

    private var permissionPrompt: some View {
        VStack(spacing: 16) {
            Image(systemName: "camera.metering.unknown")
                .font(.system(size: 42))
                .foregroundColor(.alertRed)
            Text("CAMERA ACCESS DENIED")
                .font(.monoHeadline)
                .foregroundColor(.neonGreen)
            Text("Enable camera access in Settings to start tripping.")
                .font(.monoCaption)
                .foregroundColor(.matrixGreen)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
        }
    }

    // MARK: Helpers

    private func requestCameraThenStart() async {
        let status = AVCaptureDevice.authorizationStatus(for: .video)
        switch status {
        case .authorized:
            engine.start()
        case .notDetermined:
            let granted = await AVCaptureDevice.requestAccess(for: .video)
            if granted {
                engine.start()
            } else {
                permissionDenied = true
            }
        default:
            permissionDenied = true
        }
    }

    private func saveToLibrary(_ image: UIImage) {
        PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
            DispatchQueue.main.async {
                guard status == .authorized || status == .limited else {
                    showToast("Photos access denied")
                    return
                }
                PHPhotoLibrary.shared().performChanges {
                    PHAssetChangeRequest.creationRequestForAsset(from: image)
                } completionHandler: { ok, _ in
                    DispatchQueue.main.async {
                        if ok {
                            showToast("Trip saved")
                            capturedImage = nil
                        } else {
                            showToast("Failed to save")
                        }
                    }
                }
            }
        }
    }

    private func showToast(_ message: String) {
        withAnimation { toastMessage = message }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            withAnimation { toastMessage = nil }
        }
    }
}

// MARK: - Trip modes

enum TripMode: String, CaseIterable, Identifiable {
    case kaleidoscope, twirl, ripple, fractal

    var id: String { rawValue }

    var title: String {
        switch self {
        case .kaleidoscope: return "Kaleidoscope"
        case .twirl:        return "Twirl"
        case .ripple:       return "Ripple"
        case .fractal:      return "Fractal"
        }
    }

    var shortLabel: String {
        switch self {
        case .kaleidoscope: return "KALEIDO"
        case .twirl:        return "TWIRL"
        case .ripple:       return "RIPPLE"
        case .fractal:      return "FRACTAL"
        }
    }

    var icon: String {
        switch self {
        case .kaleidoscope: return "snowflake"
        case .twirl:        return "tornado"
        case .ripple:       return "wave.3.right"
        case .fractal:      return "circle.hexagongrid.fill"
        }
    }
}

// MARK: - Camera Engine

final class TrippyCameraEngine: NSObject, ObservableObject {
    @Published var intensity: Double = 0.7 {
        didSet { paramsLock.lock(); _intensity = intensity; paramsLock.unlock() }
    }
    @Published var mode: TripMode = .kaleidoscope {
        didSet { paramsLock.lock(); _mode = mode; paramsLock.unlock() }
    }

    let metalDevice: MTLDevice?
    let ciContext: CIContext

    private let session = AVCaptureSession()
    private let videoOutput = AVCaptureVideoDataOutput()
    private let sessionQueue = DispatchQueue(label: "synaptyc.trip.camera.session")
    private let bufferQueue  = DispatchQueue(label: "synaptyc.trip.camera.buffer")

    private var currentPosition: AVCaptureDevice.Position = .back
    private var configured = false
    private let startTime = CFAbsoluteTimeGetCurrent()

    private let frameLock = NSLock()
    private var _latestFiltered: CIImage?

    private let paramsLock = NSLock()
    private var _intensity: Double = 0.7
    private var _mode: TripMode = .kaleidoscope

    private let captureLock = NSLock()
    private var pendingCapture: ((UIImage?) -> Void)?

    var latestFiltered: CIImage? {
        frameLock.lock(); defer { frameLock.unlock() }
        return _latestFiltered
    }

    override init() {
        let dev = MTLCreateSystemDefaultDevice()
        self.metalDevice = dev
        if let dev {
            self.ciContext = CIContext(mtlDevice: dev, options: [.cacheIntermediates: false])
        } else {
            self.ciContext = CIContext(options: [.cacheIntermediates: false])
        }
        super.init()
    }

    // MARK: Session control

    func start() {
        sessionQueue.async { [weak self] in
            guard let self else { return }
            if !self.configured { self.configure() }
            if !self.session.isRunning { self.session.startRunning() }
        }
    }

    func stop() {
        sessionQueue.async { [weak self] in
            guard let self else { return }
            if self.session.isRunning { self.session.stopRunning() }
        }
    }

    func flipCamera() {
        sessionQueue.async { [weak self] in
            guard let self else { return }
            self.currentPosition = self.currentPosition == .back ? .front : .back
            self.session.beginConfiguration()
            for input in self.session.inputs { self.session.removeInput(input) }
            if let input = self.makeInput(position: self.currentPosition) {
                self.session.addInput(input)
            }
            self.applyConnectionSettings()
            self.session.commitConfiguration()
        }
    }

    func capture(_ completion: @escaping (UIImage?) -> Void) {
        captureLock.lock()
        pendingCapture = completion
        captureLock.unlock()
    }

    private func configure() {
        session.beginConfiguration()
        session.sessionPreset = .high
        if let input = makeInput(position: currentPosition) {
            session.addInput(input)
        }
        videoOutput.videoSettings = [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
        ]
        videoOutput.alwaysDiscardsLateVideoFrames = true
        videoOutput.setSampleBufferDelegate(self, queue: bufferQueue)
        if session.canAddOutput(videoOutput) {
            session.addOutput(videoOutput)
        }
        applyConnectionSettings()
        session.commitConfiguration()
        configured = true
    }

    private func applyConnectionSettings() {
        guard let conn = videoOutput.connection(with: .video) else { return }
        if conn.isVideoRotationAngleSupported(90) {
            conn.videoRotationAngle = 90
        }
        if conn.isVideoMirroringSupported {
            conn.automaticallyAdjustsVideoMirroring = false
            conn.isVideoMirrored = currentPosition == .front
        }
    }

    private func makeInput(position: AVCaptureDevice.Position) -> AVCaptureDeviceInput? {
        guard let device = AVCaptureDevice.default(.builtInWideAngleCamera,
                                                   for: .video,
                                                   position: position),
              let input = try? AVCaptureDeviceInput(device: device) else {
            return nil
        }
        return input
    }

    // MARK: Filter chain

    fileprivate func applyTrip(to source: CIImage,
                               time: Double,
                               intensity: Double,
                               mode: TripMode) -> CIImage {
        let extent = source.extent
        let center = CGPoint(x: extent.midX, y: extent.midY)
        let amt = max(0.0, min(1.0, intensity))
        var image = source

        // 1. Saturation / contrast pump (with subtle brightness wobble)
        if let f = CIFilter(name: "CIColorControls", parameters: [
            kCIInputImageKey:      image,
            kCIInputSaturationKey: 1.0 + amt * 1.6,
            kCIInputBrightnessKey: 0.05 * amt * sin(time * 1.4),
            kCIInputContrastKey:   1.0 + amt * 0.3
        ])?.outputImage {
            image = f
        }

        // 2. Animated hue rotation — the rainbow shimmer
        let hue = CGFloat(time) * CGFloat(0.6 + amt)
        if let f = CIFilter(name: "CIHueAdjust", parameters: [
            kCIInputImageKey: image,
            kCIInputAngleKey: hue
        ])?.outputImage {
            image = f
        }

        // 3. Mode-specific spatial distortion
        switch mode {
        case .kaleidoscope:
            let count = 6 + Int(amt * 6)
            if let f = CIFilter(name: "CIKaleidoscope", parameters: [
                kCIInputImageKey:  image,
                "inputCount":      count,
                kCIInputCenterKey: CIVector(cgPoint: center),
                kCIInputAngleKey:  time * 0.4
            ])?.outputImage {
                image = f.cropped(to: extent)
            }
        case .twirl:
            let radius = min(extent.width, extent.height) * 0.6
            let angle = sin(time * 0.8) * .pi * (0.5 + amt)
            if let f = CIFilter(name: "CITwirlDistortion", parameters: [
                kCIInputImageKey:  image,
                kCIInputCenterKey: CIVector(cgPoint: center),
                kCIInputRadiusKey: radius,
                kCIInputAngleKey:  angle
            ])?.outputImage {
                image = f.cropped(to: extent)
            }
        case .ripple:
            let radius = min(extent.width, extent.height) * (0.3 + 0.4 * abs(sin(time)))
            let scale  = 30.0 * amt * sin(time * 1.3)
            if let f = CIFilter(name: "CIBumpDistortion", parameters: [
                kCIInputImageKey:  image,
                kCIInputCenterKey: CIVector(cgPoint: center),
                kCIInputRadiusKey: radius,
                kCIInputScaleKey:  scale
            ])?.outputImage {
                image = f.cropped(to: extent)
            }
        case .fractal:
            let inset0 = CIVector(x: extent.width * 0.30, y: extent.height * 0.30)
            let inset1 = CIVector(x: extent.width * 0.70, y: extent.height * 0.70)
            if let f = CIFilter(name: "CIDroste", parameters: [
                kCIInputImageKey:    image,
                "inputInsetPoint0":  inset0,
                "inputInsetPoint1":  inset1,
                "inputStrands":      1.0,
                "inputPeriodicity":  1.0,
                "inputRotation":     time * 0.2,
                "inputZoom":         1.0 + amt * 0.4
            ])?.outputImage {
                image = f.cropped(to: extent)
            }
        }

        // 4. Bloom — the neon glow halo
        if let f = CIFilter(name: "CIBloom", parameters: [
            kCIInputImageKey:     image,
            kCIInputRadiusKey:    8.0,
            kCIInputIntensityKey: 0.4 + 0.6 * amt
        ])?.outputImage {
            image = f.cropped(to: extent)
        }

        // 5. Vibrance for that final saturated kick
        if let f = CIFilter(name: "CIVibrance", parameters: [
            kCIInputImageKey: image,
            "inputAmount":    Double(amt)
        ])?.outputImage {
            image = f
        }

        return image
    }

    private func snapshotParams() -> (Double, TripMode) {
        paramsLock.lock(); defer { paramsLock.unlock() }
        return (_intensity, _mode)
    }
}

extension TrippyCameraEngine: AVCaptureVideoDataOutputSampleBufferDelegate {
    func captureOutput(_ output: AVCaptureOutput,
                       didOutput sampleBuffer: CMSampleBuffer,
                       from connection: AVCaptureConnection) {
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }

        let source = CIImage(cvPixelBuffer: pixelBuffer)
        let elapsed = CFAbsoluteTimeGetCurrent() - startTime
        let (intensity, mode) = snapshotParams()
        let processed = applyTrip(to: source, time: elapsed, intensity: intensity, mode: mode)

        frameLock.lock()
        _latestFiltered = processed
        frameLock.unlock()

        captureLock.lock()
        let pending = pendingCapture
        pendingCapture = nil
        captureLock.unlock()

        if let pending {
            let extent = processed.extent
            let cgImage = ciContext.createCGImage(processed, from: extent)
            let uiImage = cgImage.map { UIImage(cgImage: $0) }
            DispatchQueue.main.async { pending(uiImage) }
        }
    }
}

// MARK: - Metal preview

struct TrippyMetalPreview: UIViewRepresentable {
    let engine: TrippyCameraEngine

    func makeCoordinator() -> Coordinator {
        Coordinator(engine: engine)
    }

    func makeUIView(context: Context) -> MTKView {
        let view = MTKView()
        view.device = engine.metalDevice
        view.framebufferOnly = false
        view.enableSetNeedsDisplay = false
        view.isPaused = false
        view.preferredFramesPerSecond = 30
        view.colorPixelFormat = .bgra8Unorm
        view.delegate = context.coordinator
        view.isOpaque = true
        view.backgroundColor = .black
        return view
    }

    func updateUIView(_ uiView: MTKView, context: Context) {
        context.coordinator.engine = engine
    }

    final class Coordinator: NSObject, MTKViewDelegate {
        var engine: TrippyCameraEngine
        private let commandQueue: MTLCommandQueue?
        private let colorSpace = CGColorSpaceCreateDeviceRGB()

        init(engine: TrippyCameraEngine) {
            self.engine = engine
            self.commandQueue = engine.metalDevice?.makeCommandQueue()
        }

        func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) {}

        func draw(in view: MTKView) {
            guard let drawable = view.currentDrawable,
                  let buffer = commandQueue?.makeCommandBuffer(),
                  let image = engine.latestFiltered else {
                return
            }
            let drawSize = view.drawableSize
            let extent = image.extent
            guard extent.width > 0, extent.height > 0,
                  drawSize.width > 0, drawSize.height > 0 else {
                return
            }

            let scale = max(drawSize.width / extent.width,
                            drawSize.height / extent.height)
            let scaled = image.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
            let scaledExtent = scaled.extent
            let dx = (drawSize.width - scaledExtent.width) / 2 - scaledExtent.origin.x
            let dy = (drawSize.height - scaledExtent.height) / 2 - scaledExtent.origin.y
            let centered = scaled.transformed(by: CGAffineTransform(translationX: dx, y: dy))

            let bounds = CGRect(origin: .zero, size: drawSize)
            engine.ciContext.render(centered,
                                    to: drawable.texture,
                                    commandBuffer: buffer,
                                    bounds: bounds,
                                    colorSpace: colorSpace)
            buffer.present(drawable)
            buffer.commit()
        }
    }
}
