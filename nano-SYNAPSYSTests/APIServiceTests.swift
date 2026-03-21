import XCTest
@testable import nano_SYNAPSYS

final class APIServiceTests: XCTestCase {

    func test_apiError_descriptions() {
        let errors: [(APIError, String)] = [
            (.invalidURL, "Invalid URL"),
            (.invalidResponse, "Invalid response from server"),
            (.decodingError, "Failed to decode response"),
            (.networkError, "Network error occurred"),
            (.unauthorized, "Unauthorized request"),
            (.notFound, "Resource not found"),
            (.serverError, "Server error occurred"),
            (.unknown, "An unknown error occurred")
        ]

        for (error, expectedDescription) in errors {
            XCTAssertEqual(error.localizedDescription, expectedDescription, "Error description mismatch for \(error)")
        }
    }

    func test_apiError_types() {
        let invalidURL = APIError.invalidURL
        let networkError = APIError.networkError
        let unauthorized = APIError.unauthorized

        XCTAssertNotEqual(invalidURL, networkError)
        XCTAssertNotEqual(networkError, unauthorized)
    }

    func test_apiError_equatable() {
        let error1 = APIError.invalidURL
        let error2 = APIError.invalidURL
        let error3 = APIError.networkError

        XCTAssertEqual(error1, error2, "Same error types should be equal")
        XCTAssertNotEqual(error1, error3, "Different error types should not be equal")
    }
}
