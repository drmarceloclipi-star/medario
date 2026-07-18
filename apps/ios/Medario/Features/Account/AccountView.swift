import SwiftUI

struct AccountView: View {
    @State private var viewModel: AccountViewModel
    private let nativeNotificationViewModel: NativeNotificationViewModel

    init(viewModel: AccountViewModel, nativeNotificationViewModel: NativeNotificationViewModel) {
        _viewModel = State(initialValue: viewModel)
        self.nativeNotificationViewModel = nativeNotificationViewModel
    }

    var body: some View {
        NavigationStack {
            Group {
                switch viewModel.session {
                case .loading:
                    ProgressView("Carregando sua conta…")
                        .controlSize(.large)
                        .accessibilityLabel("Carregando sua conta")
                case .signedOut:
                    AccountAuthenticationView(viewModel: viewModel)
                case let .signedIn(user):
                    SignedInAccountView(
                        viewModel: viewModel,
                        nativeNotificationViewModel: nativeNotificationViewModel,
                        user: user
                    )
                }
            }
            .navigationTitle("Conta")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}
