import Foundation

struct AccountUser: Equatable, Sendable {
    let id: String
    let email: String?
    let displayName: String?
    let emailVerified: Bool

    init(id: String, email: String?, displayName: String?, emailVerified: Bool = false) {
        self.id = id
        self.email = email
        self.displayName = displayName
        self.emailVerified = emailVerified
    }
}
