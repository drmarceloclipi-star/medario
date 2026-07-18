import Foundation

struct ProfileContacts: Codable, Hashable, Sendable {
    let whatsApp: VerifiedContact?
    let phone: VerifiedContact?

    var isEmpty: Bool {
        whatsApp == nil && phone == nil
    }
}
