import SwiftUI

struct RootView: View {
    @State private var selectedTab: RootTab = .directory
    @State private var deepLinkSlug: String?
    private let directoryViewModel: DirectoryViewModel
    private let accountViewModel: AccountViewModel
    private let nativeNotificationViewModel: NativeNotificationViewModel
    private let savedItemsViewModel: SavedItemsViewModel
    private let appointmentRepository: any AppointmentRepository
    private let appointmentSessionSource: any SavedItemsSessionSource
    private let myAppointmentsViewModel: MyAppointmentsViewModel

    init(
        directoryViewModel: DirectoryViewModel,
        accountViewModel: AccountViewModel,
        nativeNotificationViewModel: NativeNotificationViewModel,
        savedItemsViewModel: SavedItemsViewModel,
        appointmentRepository: any AppointmentRepository,
        appointmentSessionSource: any SavedItemsSessionSource,
        myAppointmentsViewModel: MyAppointmentsViewModel
    ) {
        self.directoryViewModel = directoryViewModel
        self.accountViewModel = accountViewModel
        self.nativeNotificationViewModel = nativeNotificationViewModel
        self.savedItemsViewModel = savedItemsViewModel
        self.appointmentRepository = appointmentRepository
        self.appointmentSessionSource = appointmentSessionSource
        self.myAppointmentsViewModel = myAppointmentsViewModel
    }

    var body: some View {
        TabView(selection: $selectedTab) {
            Tab("Diretório", systemImage: "stethoscope", value: .directory) {
                DirectoryView(
                    viewModel: directoryViewModel,
                    savedItemsViewModel: savedItemsViewModel,
                    appointmentRepository: appointmentRepository,
                    appointmentSessionSource: appointmentSessionSource,
                    deepLinkSlug: $deepLinkSlug
                )
            }

            Tab("Salvos", systemImage: "bookmark", value: .savedItems) {
                SavedItemsView(viewModel: savedItemsViewModel)
            }

            Tab("Agenda", systemImage: "calendar", value: .appointments) {
                MyAppointmentsView(viewModel: myAppointmentsViewModel)
            }

            Tab("Conta", systemImage: "person.crop.circle", value: .account) {
                AccountView(
                    viewModel: accountViewModel,
                    nativeNotificationViewModel: nativeNotificationViewModel
                )
            }
        }
        .onOpenURL { url in
            guard case let .profile(slug) = MedarioDeepLink.parse(url) else { return }
            selectedTab = .directory
            deepLinkSlug = slug
        }
        .onReceive(NotificationCenter.default.publisher(for: .medarioNotificationDestination)) { notification in
            guard let destination = notification.object as? String else { return }
            switch destination {
            case "appointments": selectedTab = .appointments
            case "saved_items": selectedTab = .savedItems
            default: break
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .medarioFCMTokenUpdated)) { notification in
            guard let token = notification.object as? String else { return }
            Task { await nativeNotificationViewModel.registerRefreshedToken(token) }
        }
    }
}
