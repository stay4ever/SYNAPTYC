import XCTest

final class nano_SYNAPSYSUITests: XCTestCase {
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
        let splashElement = app.images["splash_logo"]
        XCTAssertTrue(splashElement.exists, "Splash screen logo should appear on launch")

        let appName = app.staticTexts["nano-SYNAPSYS"]
        XCTAssertTrue(appName.exists, "App name should be visible on splash screen")
    }

    // MARK: - Login Screen

    func testLoginScreenElements() {
        let usernameField = app.textFields.matching(identifier: "login_username_field").firstMatch
        let passwordField = app.secureTextFields.matching(identifier: "login_password_field").firstMatch
        let loginButton = app.buttons["login_button"]

        XCTAssertTrue(usernameField.exists, "Username field should be present")
        XCTAssertTrue(passwordField.exists, "Password field should be present")
        XCTAssertTrue(loginButton.exists, "Login button should be present")

        let registerLink = app.buttons["register_link"]
        XCTAssertTrue(registerLink.exists, "Register link should be present")
    }

    // MARK: - Registration Flow

    func testRegistrationFlow() {
        let registerLink = app.buttons["register_link"]
        XCTAssertTrue(registerLink.exists)

        registerLink.tap()

        let usernameField = app.textFields.matching(identifier: "register_username_field").firstMatch
        let displayNameField = app.textFields.matching(identifier: "register_displayname_field").firstMatch
        let emailField = app.textFields.matching(identifier: "register_email_field").firstMatch
        let passwordField = app.secureTextFields.matching(identifier: "register_password_field").firstMatch
        let confirmPasswordField = app.secureTextFields.matching(identifier: "register_confirm_password_field").firstMatch

        XCTAssertTrue(usernameField.exists, "Username field should exist on registration screen")
        XCTAssertTrue(displayNameField.exists, "Display name field should exist on registration screen")
        XCTAssertTrue(emailField.exists, "Email field should exist on registration screen")
        XCTAssertTrue(passwordField.exists, "Password field should exist on registration screen")
        XCTAssertTrue(confirmPasswordField.exists, "Confirm password field should exist on registration screen")

        let registerButton = app.buttons["register_button"]
        XCTAssertTrue(registerButton.exists, "Register button should be present")
    }

    // MARK: - Accessibility

    func testAccessibilityLabels() {
        let loginButton = app.buttons["login_button"]
        XCTAssertTrue(loginButton.isAccessibilityElement)

        let usernameField = app.textFields.matching(identifier: "login_username_field").firstMatch
        XCTAssertTrue(usernameField.isAccessibilityElement)

        let registerLink = app.buttons["register_link"]
        XCTAssertTrue(registerLink.isAccessibilityElement)
    }
}
