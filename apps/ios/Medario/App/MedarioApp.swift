import FirebaseCore
import FirebaseAppCheck
import SwiftUI

@main
struct MedarioApp: App {
    @UIApplicationDelegateAdaptor(MedarioAppDelegate.self) private var appDelegate
    private let directoryViewModel: DirectoryViewModel
    private let accountViewModel: AccountViewModel
    private let nativeNotificationViewModel: NativeNotificationViewModel
    private let savedItemsViewModel: SavedItemsViewModel
    private let appointmentRepository: FirebaseAppointmentRepository
    private let myAppointmentsViewModel: MyAppointmentsViewModel
    private let accountRepository: FirebaseAccountRepository

    init() {
        #if DEBUG
        AppCheck.setAppCheckProviderFactory(AppCheckDebugProviderFactory())
        #else
        AppCheck.setAppCheckProviderFactory(MedarioAppCheckProviderFactory())
        #endif
        FirebaseApp.configure()
        let accountRepository = FirebaseAccountRepository()
        self.accountRepository = accountRepository
        let appointmentRepository = FirebaseAppointmentRepository()
        self.appointmentRepository = appointmentRepository
        directoryViewModel = DirectoryViewModel(repository: FirebasePublicDirectoryRepository())
        accountViewModel = AccountViewModel(repository: accountRepository)
        nativeNotificationViewModel = NativeNotificationViewModel(
            repository: FirebaseNativeNotificationRepository(),
            permissionService: FirebaseNativeNotificationPermissionService(),
            sessionSource: accountRepository
        )
        savedItemsViewModel = SavedItemsViewModel(
            repository: DefaultSavedItemsRepository(),
            sessionSource: accountRepository
        )
        myAppointmentsViewModel = MyAppointmentsViewModel(repository: appointmentRepository, sessionSource: accountRepository)
    }

    var body: some Scene {
        WindowGroup {
            RootView(
                directoryViewModel: directoryViewModel,
                accountViewModel: accountViewModel,
                nativeNotificationViewModel: nativeNotificationViewModel,
                savedItemsViewModel: savedItemsViewModel,
                appointmentRepository: appointmentRepository,
                appointmentSessionSource: accountRepository,
                myAppointmentsViewModel: myAppointmentsViewModel
            )
            .tint(MedarioTheme.joinvilleBlue)
        }
    }
}
