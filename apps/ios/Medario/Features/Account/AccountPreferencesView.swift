import SwiftUI

struct AccountPreferencesView: View {
    @Bindable var viewModel: AccountViewModel

    var body: some View {
        Section("Preferências") {
            TextField("Cidade", text: $viewModel.preferences.city)
                .textContentType(.addressCity)
            TextField("Convênio", text: $viewModel.preferences.insurance)
            TextField("Modalidade", text: $viewModel.preferences.modality)
            TextField("Idioma", text: $viewModel.preferences.language)
            Toggle("Preciso de recursos de acessibilidade", isOn: $viewModel.preferences.accessibilitySupport)

            Button("Salvar preferências", action: save)
                .buttonStyle(.borderedProminent)
                .disabled(viewModel.isSavingPreferences)

            if viewModel.isSavingPreferences {
                ProgressView("Salvando preferências…")
            }
        }
    }

    private func save() {
        Task { await viewModel.savePreferences() }
    }
}
