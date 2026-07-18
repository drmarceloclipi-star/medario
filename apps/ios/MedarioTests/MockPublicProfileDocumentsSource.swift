import Foundation
@testable import Medario

@MainActor
final class MockPublicProfileDocumentsSource: PublicProfileDocumentsSource {
    private(set) var callCount = 0
    var documents: [PublicProfileDocument]

    init(documents: [PublicProfileDocument]) {
        self.documents = documents
    }

    func publishedDocuments() async throws -> [PublicProfileDocument] {
        callCount += 1
        return documents
    }
}
