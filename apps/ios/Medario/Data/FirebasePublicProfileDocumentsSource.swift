import FirebaseFirestore
import Foundation

@MainActor
final class FirebasePublicProfileDocumentsSource: PublicProfileDocumentsSource {
    private let database: Firestore

    init(database: Firestore = Firestore.firestore()) {
        self.database = database
    }

    func publishedDocuments() async throws -> [PublicProfileDocument] {
        let snapshot = try await database.collection("publicDoctors")
            .whereField("published", isEqualTo: true)
            .whereField("publicReadSafe", isEqualTo: true)
            .getDocuments()
        return snapshot.documents.map {
            PublicProfileDocument(id: $0.documentID, data: $0.data())
        }
    }
}
