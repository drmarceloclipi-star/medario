@preconcurrency import FirebaseAuth
@preconcurrency import FirebaseFirestore
import Foundation

@MainActor
final class FirebaseAccountBackendGateway: AccountBackendGateway {
    private let auth: Auth
    private let firestore: Firestore

    init(auth: Auth = .auth(), firestore: Firestore = .firestore()) {
        self.auth = auth
        self.firestore = firestore
    }

    var currentSession: AccountSession {
        session(for: auth.currentUser)
    }

    func subscribe(_ listener: @escaping @MainActor (AccountSession) -> Void) -> any AccountSessionSubscription {
        listener(.loading)
        let handle = auth.addStateDidChangeListener { [weak self] _, user in
            Task { @MainActor [weak self] in
                guard let self else { return }
                listener(self.session(for: user))
            }
        }
        return FirebaseAccountSessionSubscription(auth: auth, handle: handle)
    }

    func signIn(email: String, password: String) async throws {
        do {
            _ = try await auth.signIn(withEmail: email, password: password)
        } catch {
            throw mappedError(error)
        }
    }

    func createPatientAccount(email: String, password: String) async throws {
        do {
            let result = try await auth.createUser(withEmail: email, password: password)
            let displayName = email.split(separator: "@").first.map(String.init)
            if let displayName {
                let request = result.user.createProfileChangeRequest()
                request.displayName = displayName
                try? await request.commitChanges()
            }
            try await result.user.sendEmailVerification()
        } catch {
            throw mappedError(error)
        }
    }

    func signOut() async throws {
        do {
            try auth.signOut()
        } catch {
            throw mappedError(error)
        }
    }

    func profile() async throws -> AccountProfile {
        let user = try requiredUser()
        do {
            let snapshot = try await profileReference(userID: user.uid).getDocument()
            return AccountProfileMapper.profile(from: snapshot.data() ?? [:], fallbackEmail: user.email ?? "")
        } catch {
            throw mappedError(error)
        }
    }

    func updatePreferences(_ preferences: AccountPreferences) async throws {
        let user = try requiredUser()
        var fields = AccountProfileMapper.firestoreFields(from: preferences)
        fields["updated_at"] = FieldValue.serverTimestamp()
        try await writeProfile(fields, user: user)
    }

    func grantHealthConsent() async throws {
        let user = try requiredUser()
        try await writeProfile(
            [
                "consent_preferences": true,
                "consent_at": FieldValue.serverTimestamp(),
            ],
            user: user
        )
    }

    func reloadCurrentUser() async throws -> AccountSession {
        let user = try requiredUser()
        do {
            try await user.reload()
            _ = try await user.getIDToken(forcingRefresh: true)
            return session(for: auth.currentUser)
        } catch {
            throw mappedError(error)
        }
    }

    func reauthenticate(password: String) async throws {
        let user = try requiredUser()
        guard let email = user.email else { throw AccountRepositoryError.passwordRequired }
        do {
            let credential = EmailAuthProvider.credential(withEmail: email, password: password)
            try await user.reauthenticate(with: credential)
        } catch {
            throw mappedError(error)
        }
    }

    func refreshIDToken() async throws {
        let user = try requiredUser()
        do {
            _ = try await user.getIDToken(forcingRefresh: true)
        } catch {
            throw mappedError(error)
        }
    }

    private func requiredUser() throws -> User {
        guard let user = auth.currentUser else { throw AccountRepositoryError.authenticationRequired }
        return user
    }

    private func writeProfile(_ fields: [String: Any], user: User) async throws {
        let reference = profileReference(userID: user.uid)
        do {
            let snapshot = try await reference.getDocument()
            if snapshot.exists {
                try await reference.updateData(fields)
            } else {
                var initialFields = fields
                initialFields["email"] = user.email ?? NSNull()
                initialFields["created_at"] = FieldValue.serverTimestamp()
                try await reference.setData(initialFields, merge: true)
            }
        } catch {
            throw mappedError(error)
        }
    }

    private func profileReference(userID: String) -> DocumentReference {
        firestore.collection("users").document(userID)
    }

    private func session(for user: User?) -> AccountSession {
        guard let user else { return .signedOut }
        return .signedIn(AccountUser(
            id: user.uid,
            email: user.email,
            displayName: user.displayName,
            emailVerified: user.isEmailVerified
        ))
    }

    private func mappedError(_ error: Error) -> AccountRepositoryError {
        let code = AuthErrorCode(rawValue: (error as NSError).code)
        return switch code {
        case .requiresRecentLogin:
            .reauthenticationRequired
        case .wrongPassword, .invalidCredential, .userNotFound, .invalidEmail:
            .invalidCredentials
        case .emailAlreadyInUse:
            .emailAlreadyInUse
        case .weakPassword:
            .weakPassword
        case .networkError:
            .networkUnavailable
        default:
            .operationFailed
        }
    }
}
