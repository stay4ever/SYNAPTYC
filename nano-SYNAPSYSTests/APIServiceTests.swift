import XCTest
@testable import nano_SYNAPSYS

// swiftlint:disable force_cast force_unwrapping
final class APIServiceTests: XCTestCase {

    func test_apiError_descriptions() {
        XCTAssertNotNil(APIError.invalidURL.errorDescription)
        XCTAssertNotNil(APIError.noData.errorDescription)
        XCTAssertNotNil(APIError.unauthorized.errorDescription)
        XCTAssertNotNil(APIError.serverError("test").errorDescription)
        XCTAssertTrue(APIError.serverError("custom msg").errorDescription?.contains("custom msg") ?? false)
    }

    func test_apiError_unauthorized_message() {
        let err = APIError.unauthorized
        XCTAssertTrue(err.errorDescription?.contains("Session expired") ?? false)
    }

    func test_encryptionError_descriptions() {
        XCTAssertNotNil(EncryptionError.encodingFailed.errorDescription)
        XCTAssertNotNil(EncryptionError.decodingFailed.errorDescription)
        XCTAssertNotNil(EncryptionError.sealFailed.errorDescription)
        XCTAssertNotNil(EncryptionError.keyExchangeFailed.errorDescription)
    }
}
