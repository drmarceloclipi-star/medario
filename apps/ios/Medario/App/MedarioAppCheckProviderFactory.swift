@preconcurrency import FirebaseAppCheck
@preconcurrency import FirebaseCore
import Foundation

final class MedarioAppCheckProviderFactory: NSObject, AppCheckProviderFactory {
    func createProvider(with app: FirebaseApp) -> (any AppCheckProvider)? {
        AppAttestProvider(app: app)
    }
}
