import Foundation

@MainActor
protocol SearchInterpreter {
    func interpret(_ query: String, catalog: DirectorySearchCatalog) async -> SearchInterpretation
    func prewarm() async
}

extension SearchInterpreter {
    func prewarm() async {}
}