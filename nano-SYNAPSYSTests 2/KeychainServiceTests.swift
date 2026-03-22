import XCTest
import CryptoKit
@testable import nano_SYNAPSYS

// swiftlint:disable force_cast force_unwrapping
final class KeychainServiceTests: XCTestCase {

    private let testKey = "nano_test_keychain_\(UUID().uuidString)"

    override func tearDown() {
        KeychainService.delete(testKey)
        super.tearDown()
    }

    func test_saveAndLoad_string() {
        let value = "jwt-token-abc123"
        XCTAssertTrue(KeychainService.save(value, for: testKey))
        XCTAssertEqual(KeychainService.load(testKey), value)
    }

    func test_overwrite_updatesValue() {
        KeychainService.save("first", for: testKey)
        KeychainService.save("second", for: testKey)
        XCTAssertEqual(KeychainService.load(testKey), "second")
    }

    func test_delete_removesValue() {
        KeychainService.save("to-delete", for: testKey)
        XCTAssertTrue(KeychainService.delete(testKey))
        XCTAssertNil(KeychainService.load(testKey))
    }

    func test_loadMissingKey_returnsNil() {
        XCTAssertNil(KeychainService.load("nano_nonexistent_\(UUID().uuidString)"))
    }

    func test_saveAndLoad_data() {
        let data = Data([0x00, 0xFF, 0xAB, 0xCD])
        XCTAssertTrue(KeychainService.saveData(data, for: testKey))
        XCTAssertEqual(KeychainService.loadData(testKey), data)
    }

    func test_saveAndLoad_symmetricKey() {
        let key = SymmetricKey(size: .bits256)
        let bytes = key.withUnsafeBytes { Data($0) }
        KeychainService.saveData(bytes, for: testKey)
        guard let loaded = KeychainService.loadData(testKey) else {
            return XCTFail("Expected data in keychain")
        }
        let restored = SymmetricKey(data: loaded)
        let restoredBytes = restored.withUnsafeBytes { Data($0) }
        XCTAssertEqual(bytes, restoredBytes)
    }

    func test_saveEmptyString() {
        XCTAssertTrue(KeychainService.save("", for: testKey))
        XCTAssertEqual(KeychainService.load(testKey), "")
    }

    func test_saveEmptyData() {
        let data = Data()
        XCTAssertTrue(KeychainService.saveData(data, for: testKey))
        XCTAssertEqual(KeychainService.loadData(testKey), data)
    }
}
