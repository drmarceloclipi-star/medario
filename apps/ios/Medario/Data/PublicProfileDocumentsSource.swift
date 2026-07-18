import Foundation

@MainActor
protocol PublicProfileDocumentsSource {
    func publishedDocuments() async throws -> [PublicProfileDocument]
}
