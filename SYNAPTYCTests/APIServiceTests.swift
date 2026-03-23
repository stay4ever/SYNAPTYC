import XCTest
@testable import SYNAPTYC

final class APIServiceTests: XCTestCase {

    func test_apiError_descriptions() {
        XCTAssertEqual(APIError.invalidURL.localizedDescription, "Invalid URL")
        XCTAssertEqual(APIError.noData.localizedDescription, "No data received")
        XCTAssertEqual(APIError.serverError("Something went wrong").localizedDescription, "Something went wrong")
        XCTAssertEqual(APIError.unauthorized.localizedDescription, "Session expired. Please log in again.")
    }

    func test_apiError_decodingError() {
        struct Dummy: LocalizedError {
            var errorDescription: String? { "dummy error" }
        }
        let apiErr = APIError.decodingError(Dummy())
        XCTAssertNotNil(apiErr.localizedDescription)
        XCTAssertTrue(apiErr.localizedDescription.hasPrefix("Data error:"))
    }

    func test_apiError_types() {
        let invalidURL = APIError.invalidURL
        let unauthorized = APIError.unauthorized
        let noData = APIError.noData

        XCTAssertNotNil(invalidURL.localizedDescription)
        XCTAssertNotNil(unauthorized.localizedDescription)
        XCTAssertNotEqual(
            invalidURL.localizedDescription,
            unauthorized.localizedDescription,
            "Different error types should have distinct descriptions"
        )
        XCTAssertNotEqual(
            unauthorized.localizedDescription,
            noData.localizedDescription
        )
    }

    func test_apiError_serverError_message() {
        let message = "Internal server error"
        let error = APIError.serverError(message)
        XCTAssertEqual(error.localizedDescription, message)
    }
}
