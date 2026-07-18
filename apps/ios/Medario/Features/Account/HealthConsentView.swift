import SwiftUI

struct HealthConsentView: View {
    @Bindable var viewModel: AccountViewModel

    var body: some View {
        Section("Consentimento de saúde") {
            Toggle("Permitir que sinais de saúde orientem buscas salvas", isOn: $viewModel.healthConsent)
                .disabled(viewModel.isUpdatingConsent)
            Text("Opcional. Você pode revogar quando quiser. A revogação impede novas buscas sensíveis sincronizadas e apaga interesses de saúde já derivados.")
                .foregroundStyle(.secondary)
            if viewModel.isUpdatingConsent {
                ProgressView("Atualizando consentimento…")
            }
        }
    }
}
