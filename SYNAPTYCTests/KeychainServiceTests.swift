import XCTest
@testable import SYNAPTYC
import CryptoKit

final class KeychainServiceTests: XCTestCase {

    override func tearDown() {
        let testKeys = [
            "test_string_key", "test_data_key", "test_symkey_data",
            "test_overwrite_key", "test_delete_key", "test_empty_string"
        ]
        for key in testKeys {
            KeychainService.delete(key)
        }
        super.tearDown()
    }

    // MARK: - String Storage

    func test_saveAndLoadString() {
        let key = "test_string_key"
        let value = "test_value_123"

        KeychainService.save(value, for: key)
        let loaded = KeychainService.load(key)

        XCTAssertEqual(loaded, value)
    }

    func test_saveAndLoadData() {
        let key = "test_data_key"
        let value = Data("test_data".utf8)

        KeychainService.saveData(value, for: key)
        let loaded = KeychainService.loadData(key)

        XCTAssertEqual(loaded, value)
    }

    func test_saveAndLoadSymmetricKeyAsData() {
        let key = "test_symkey_data"
        let symmetricKey = SymmetricKey(size: .bits256)
        let keyData = symmetricKey.withUnsafeBytes { Data($0) }

        KeychainService.saveData(keyData, for: key)
        let loadedData = KeychainService.loadData(key)

        XCTAssertNotNil(loadedData)
        XCTAssertEqual(loadedData, keyData)
    }

    // MARK: - Overwrite & Delete

    func test_overwriteExistingValue() {
        let key = "test_overwrite_key"
        let value1 = "first_value"
        let value2 = "second_value"

        KeychainService.save(value1, for: key)
        KeychainService.save(value2, for: key)

        let loaded = KeychainService.load(key)

        XCTAssertEqual(loaded, value2)
    }

    func test_deleteValue() {
        let key = "test_delete_key"
        let value = "value_to_delete"

        KeychainService.save(value, for: key)
        KeychainService.delete(key)

        let loaded = KeychainService.load(key)

        XCTAssertNil(loaded)
    }

    // MARK: - Edge Cases

    func test_loadNonexistentKey_returnsNil() {
        let loaded = KeychainService.load("nonexistent_key_xyz")

        XCTAssertNil(loaded)
    }

    func test_saveEmptyString() {
        let key = "test_empty_string"
        let value = ""

        KeychainService.save(value, for: key)
        let loaded = KeychainService.load(key)

        XCTAssertEqual(loaded, value)
    }

    func test_deleteNonexistentKey_returnsFalse() {
        // Deleting a non-existent key returns false (not found) and does not crash
        let result = KeychainService.delete("nonexistent_key_to_delete")
        XCTAssertFalse(result, "Deleting non-existent key should return false")
    }
}
