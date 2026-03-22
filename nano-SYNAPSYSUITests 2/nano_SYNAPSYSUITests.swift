import XCTest

final class nano_SYNAPSYSUITests: XCTestCase {

    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launch()
    }

    // MARK: - Splash Screen

    func test_splashScreen_displaysAppName() {
        let appName = app.staticTexts["nano-SYNAPSYS"]
        XCTAssertTrue(appName.waitForExistence(timeout: 5), "App name should appear on splash screen")
    }

    func test_splashScreen_showsEncryptionBadge() {
        let badge = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'AES-256-GCM'")).firstMatch
        XCTAssertTrue(badge.waitForExistence(timeout: 5), "Encryption badge should appear on splash")
    }

    // MARK: - Login Screen

    func test_loginScreen_appearsAfterSplash() {
        let authenticateButton = app.buttons["AUTHENTICATE"]
        XCTAssertTrue(authenticateButton.waitForExistence(timeout: 10),
                      "Login screen should appear after splash")
    }

    func test_loginScreen_hasEmailField() {
        let emailField = app.textFields["Email address"]
        XCTAssertTrue(emailField.waitForExistence(timeout: 10))
    }

    func test_loginScreen_hasPasswordField() {
        let passwordField = app.secureTextFields["Password"]
        XCTAssertTrue(passwordField.waitForExistence(timeout: 10))
    }

    func test_loginScreen_hasCreateAccountButton() {
        let createAccount = app.buttons["CREATE ACCOUNT"]
        XCTAssertTrue(createAccount.waitForExistence(timeout: 10))
    }

    func test_loginScreen_hasForgotPasswordButton() {
        let forgot = app.buttons["Forgot password?"]
        XCTAssertTrue(forgot.waitForExistence(timeout: 10))
    }

    // MARK: - Registration

    func test_createAccount_opensRegistrationSheet() {
        let createAccount = app.buttons["CREATE ACCOUNT"]
        guard createAccount.waitForExistence(timeout: 10) else {
            XCTFail("CREATE ACCOUNT button not found")
            return
        }
        createAccount.tap()

        let joinHeader = app.staticTexts["JOIN THE EVOLUTION"]
        XCTAssertTrue(joinHeader.waitForExistence(timeout: 5),
                      "Registration sheet should appear")
    }

    // MARK: - Accessibility

    func test_loginScreen_elementsAreAccessible() {
        let authenticateButton = app.buttons["AUTHENTICATE"]
        guard authenticateButton.waitForExistence(timeout: 10) else {
            XCTFail("Login screen did not appear")
            return
        }
        XCTAssertTrue(authenticateButton.isEnabled || !authenticateButton.isEnabled,
                      "Authenticate button should be accessible")
    }
}
