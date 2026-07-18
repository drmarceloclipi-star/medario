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

    private func launchedApp() -> XCUIApplication {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchArguments = ["-AppleLanguages", "(pt-BR)", "-AppleLocale", "pt_BR"]
        app.launch()
        return app
    }
}
