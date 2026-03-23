import XCTest

final class SYNAPTYCUITests: XCTestCase {
    var app: XCUIApplication!

    override func setUp() {
        super.setUp()
        continueAfterFailure = false
        app = XCUIApplication()
        app.launch()
    }

    override func tearDown() {
        app = nil
        super.tearDown()
    }

    // MARK: - Splash Screen

    func testSplashScreenAppears() {
        // The splash screen fades in quickly; check for the logo or app name text
        let splashLogo = app.images["splash_logo"]
        let appName = app.staticTexts["SYNAPTYC"]

        // At least one of these should exist immediately after launch
        let splashOrLoginVisible = splashLogo.exists || appName.exists
        XCTAssertTrue(splashOrLoginVisible, "Either splash logo or app name should be visible on launch")
    }

    // MARK: - Login Screen

    func testLoginScreenElements() {
        // Wait for login screen to appear after splash
        let usernameField = app.textFields.matching(identifier: "login_username_field").firstMatch
        let passwordField = app.secureTextFields.matching(identifier: "login_password_field").firstMatch
        let loginButton = app.buttons["login_button"]

        XCTAssertTrue(usernameField.waitForExistence(timeout: 5), "Username field should be present")
        XCTAssertTrue(passwordField.waitForExistence(timeout: 5), "Password field should be present")
        XCTAssertTrue(loginButton.waitForExistence(timeout: 5), "Login button should be present")

        let registerLink = app.buttons["register_link"]
        XCTAssertTrue(registerLink.waitForExistence(timeout: 5), "Register link should be present")
    }

    // MARK: - Registration Flow

    func testRegistrationFlow() {
        let registerLink = app.buttons["register_link"]
        XCTAssertTrue(registerLink.waitForExistence(timeout: 5))

        registerLink.tap()

        let usernameField = app.textFields.matching(identifier: "register_username_field").firstMatch
        let displayNameField = app.textFields.matching(identifier: "register_displayname_field").firstMatch
        let emailField = app.textFields.matching(identifier: "register_email_field").firstMatch
        let passwordField = app.secureTextFields.matching(identifier: "register_password_field").firstMatch
        let confirmPasswordField = app.secureTextFields.matching(identifier: "register_confirm_password_field").firstMatch

        XCTAssertTrue(usernameField.waitForExistence(timeout: 5), "Username field should exist on registration screen")
        XCTAssertTrue(displayNameField.waitForExistence(timeout: 5), "Display name field should exist on registration screen")
        XCTAssertTrue(emailField.waitForExistence(timeout: 5), "Email field should exist on registration screen")
        XCTAssertTrue(passwordField.waitForExistence(timeout: 5), "Password field should exist on registration screen")
        XCTAssertTrue(confirmPasswordField.waitForExistence(timeout: 5), "Confirm password field should exist on registration screen")

        let registerButton = app.buttons["register_button"]
        XCTAssertTrue(registerButton.waitForExistence(timeout: 5), "Register button should be present")
    }

    // MARK: - Accessibility

    func testAccessibilityLabels() {
        let loginButton = app.buttons["login_button"]
        XCTAssertTrue(loginButton.waitForExistence(timeout: 5), "Login button should be accessible")

        let usernameField = app.textFields.matching(identifier: "login_username_field").firstMatch
        XCTAssertTrue(usernameField.waitForExistence(timeout: 5), "Username field should be accessible")

        let registerLink = app.buttons["register_link"]
        XCTAssertTrue(registerLink.waitForExistence(timeout: 5), "Register link should be accessible")
    }
}
