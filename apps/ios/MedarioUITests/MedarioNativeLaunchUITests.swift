import XCTest

@MainActor
final class MedarioNativeLaunchUITests: XCTestCase {
    func testLaunchesNativeRootWithFourTabsAndNoWebView() {
        let app = launchedApp()
        let tabBar = app.tabBars.firstMatch
        XCTAssertTrue(tabBar.waitForExistence(timeout: 15))

        for label in ["Diretório", "Salvos", "Agenda", "Conta"] {
            XCTAssertTrue(tabBar.buttons[label].exists, "Aba nativa ausente: \(label)")
        }

        XCTAssertEqual(app.webViews.count, 0, "A raiz do app não pode ser uma superfície web/híbrida")
    }

    func testEveryRootTabIsReachable() {
        let app = launchedApp()
        let tabBar = app.tabBars.firstMatch
        XCTAssertTrue(tabBar.waitForExistence(timeout: 15))

        for label in ["Salvos", "Agenda", "Conta", "Diretório"] {
            let button = tabBar.buttons[label]
            XCTAssertTrue(button.isHittable)
            button.tap()
            XCTAssertTrue(button.isSelected)
        }
    }

    func testUrgentSearchShowsAlertAndSafelyReturns() {
        let app = launchedApp()
        let tabBar = app.tabBars.firstMatch
        XCTAssertTrue(tabBar.waitForExistence(timeout: 15))

        let searchField = app.searchFields.firstMatch
        XCTAssertTrue(searchField.waitForExistence(timeout: 10))
        searchField.tap()
        searchField.typeText("dor no peito\n")

        let alert = app.alerts["Atendimento imediato"]
        XCTAssertTrue(alert.waitForExistence(timeout: 5))
        XCTAssertTrue(alert.staticTexts.containing(NSPredicate(format: "label CONTAINS '192'")).firstMatch.exists)

        let entendi = alert.buttons["Entendi"]
        XCTAssertTrue(entendi.exists)
        entendi.tap()

        XCTAssertFalse(alert.exists || alert.waitForExistence(timeout: 3))
        XCTAssertTrue(app.searchFields.firstMatch.exists)
    }

    private func launchedApp() -> XCUIApplication {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchArguments = ["-AppleLanguages", "(pt-BR)", "-AppleLocale", "pt_BR"]
        app.launch()
        return app
    }
}
