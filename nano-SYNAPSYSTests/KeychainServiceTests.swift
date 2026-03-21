import XCTest
@testable import nano_SYNAPSYS
import CryptoKit

final class KeychainServiceTests: XCTestCase {
    var sut: KeychainService!

    override func setUp() {
        super.setUp()
        sut = KeychainService()
    }

    override func tearDown() {
        sut = nil
        super.tearDown()
    }

    // MARK: - String Storage

    func test_saveAndLoadString() {
        let key = "test_string_key"
        let value = "test_value_123"

        sut.save(value, forKey: key)
        let loaded = sut.load(forKey: key) as? String

        XCTAssertEqual(loaded, value)
    }

    func test_saveAndLoadData() {
        let key = "test_data_key"
        let value = Data("test_data".utf8)

        sut.save(value, forKey: key)
        let loaded = sut.load(forKey: key) as? Data

        XCTAssertEqual(loaded, value)
    }

    func test_saveAndLoadSymmetricKey() {
        let key = "test_symmetric_key"
        let symmetricKey = SymmetricKey(size: .bits256)

        sut.save(symmetricKey, forKey: key)
        let loaded = sut.load(forKey: key) as? SymmetricKey

        XCTAssertNotNil(loaded)
    }

    // MARK: - Overwrite & Delete

    func test_overwriteExistingValue() {
        let key = "test_overwrite_key"
        let value1 = "first_value"
        let value2 = "second_value"

        sut.save(value1, forKey: key)
        sut.save(value2, forKey: key)

        let loaded = sut.load(forKey: key) as? String

        XCTAssertEqual(loaded, value2)
    }

    func test_deleteValue() {
        let key = "test_delete_key"
        let value = "value_to_delete"

        sut.save(value, forKey: key)
        sut.delete(forKey: key)

        let loaded = sut.load(forKey: key)

        XCTAssertNil(loaded)
    }

    // MARK: - Edge Cases

    func test_loadNonexistentKey_returnsNil() {
        let loaded = sut.load(forKey: "nonexistent_key_xyz")

        XCTAssertNil(loaded)
    }

    func test_saveEmptyString() {
        let key = "test_empty_string"
        let value = ""

        sut.save(value, forKey: key)
        let loaded = sut.load(forKey: key) as? String

        XCTAssertEqual(loaded, value)
    }

    func test_deleteNonexistentKey_noError() {
        XCTAssertNoThrow {
            sut.delete(forKey: "nonexistent_key_to_delete")
        }
    }
}

// MARK: - Helper

extension XCTestCase {
    func XCTAssertNoThrow(
        _ expression: @autoclosure () throws -> Void,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        do {
            try expression()
        } catch {
            XCTFail("Expected no error, but got: \(error)", file: file, line: line)
        }
    }
}
