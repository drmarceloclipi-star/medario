import SwiftUI

struct ReauthenticationView: View {
    @Bindable var viewModel: AccountViewModel

    var body: some View {
        Section("Confirmação de segurança") {
            Text("Sua sessão é antiga. Confirme sua senha para continuar a exclusão.")
                .foregroundStyle(.secondary)
            SecureField("Senha atual", text: $viewModel.reauthenticationPassword)
                .textContentType(.password)
            Button("Confirmar e excluir", role: .destructive, action: confirm)
                .disabled(viewModel.deletionState == .deleting)
            Button("Cancelar exclusão", action: viewModel.cancelReauthentication)
        }
    }

    private func confirm() {
        Task { await viewModel.reauthenticateAndDelete() }
    }
}
