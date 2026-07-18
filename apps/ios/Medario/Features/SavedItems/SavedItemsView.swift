import SwiftUI

struct SavedItemsView: View {
    @Bindable var viewModel: SavedItemsViewModel
    @State private var showingSyncConfirmation = false

    var body: some View {
        NavigationStack {
            List {
                localSection
                accountSection
            }
            .navigationTitle("Itens salvos")
            .overlay {
                if shouldShowEmptyState {
                    ContentUnavailableView(
                        "Nada salvo ainda",
                        systemImage: "bookmark",
                        description: Text("Favorite médicos ou salve filtros objetivos no diretório.")
                    )
                }
            }
            .confirmationDialog(
                "Sincronizar itens deste dispositivo?",
                isPresented: $showingSyncConfirmation,
                titleVisibility: .visible
            ) {
                Button("Sincronizar com minha conta") { Task { await viewModel.synchronizeNow() } }
                Button("Cancelar", role: .cancel) {}
            } message: {
                Text("Serão copiados \(viewModel.localItems.favorites.count) favorito(s) e \(viewModel.localItems.searches.count) busca(s). Em dispositivo compartilhado, revise antes de continuar.")
            }
            .safeAreaInset(edge: .bottom) {
                if let feedback = viewModel.feedback {
                    Text(feedback)
                        .font(.footnote)
                        .padding(12)
                        .frame(maxWidth: .infinity)
                        .background(.thinMaterial)
                        .accessibilityLabel(feedback)
                        .onTapGesture { viewModel.clearFeedback() }
                }
            }
        }
    }

    @ViewBuilder
    private var localSection: some View {
        if !viewModel.localItems.favorites.isEmpty || !viewModel.localItems.searches.isEmpty {
            Section {
                ForEach(viewModel.localItems.favorites) { favorite in
                    SavedFavoriteRow(name: favorite.name, detail: [favorite.specialty, favorite.city].filter { !$0.isEmpty }.joined(separator: " · ")) {
                        viewModel.removeLocalFavorite(favorite.doctorID)
                    }
                }
                ForEach(viewModel.localItems.searches) { search in
                    SavedSearchRow(summary: search.criteria.summary, alertEnabled: nil) { _ in } remove: {
                        viewModel.removeLocalSearch(search.id)
                    }
                }
            } header: {
                Text("Neste dispositivo")
            } footer: {
                Text("Itens locais não entram na conta automaticamente.")
            }
        }
    }

    @ViewBuilder
    private var accountSection: some View {
        switch viewModel.session {
        case .loading:
            Section("Conta") { ProgressView("Verificando sessão…") }
        case .signedOut:
            Section {
                Text("Entre na aba Conta para sincronizar quando quiser.")
                    .foregroundStyle(.secondary)
            }
        case .signedIn:
            Section {
                if !viewModel.localItems.favorites.isEmpty || !viewModel.localItems.searches.isEmpty {
                    Button {
                        showingSyncConfirmation = true
                    } label: {
                        if viewModel.isSynchronizing { ProgressView() } else { Label("Sincronizar agora", systemImage: "arrow.triangle.2.circlepath") }
                    }
                    .disabled(viewModel.isSynchronizing)
                    .accessibilityHint("Copia itens deste dispositivo para sua conta")
                }
                accountContent
            } header: {
                Text("Conta")
            } footer: {
                Text("Sincronização exige ação explícita. Itens locais permanecem no dispositivo.")
            }
        }
    }

    @ViewBuilder
    private var accountContent: some View {
        switch viewModel.accountState {
        case .idle:
            Button("Carregar itens da conta") { Task { await viewModel.loadAccountItems() } }
        case .loading:
            ProgressView("Carregando itens da conta…")
        case let .failed(message):
            VStack(alignment: .leading, spacing: 8) {
                Text(message).foregroundStyle(.secondary)
                Button("Tentar novamente") { Task { await viewModel.loadAccountItems() } }
            }
        case let .loaded(items):
            if items.favorites.isEmpty && items.searches.isEmpty {
                Text("Nenhum item sincronizado.").foregroundStyle(.secondary)
            }
            ForEach(items.favorites) { favorite in
                SavedFavoriteRow(name: "Perfil médico", detail: favorite.doctorID) {
                    Task { await viewModel.removeAccountFavorite(favorite.doctorID) }
                }
            }
            ForEach(items.searches) { search in
                SavedSearchRow(summary: search.criteria.summary, alertEnabled: search.alertEnabled) { _ in } remove: {
                    Task { await viewModel.removeAccountSearch(search.id) }
                }
            }
        }
    }

    private var shouldShowEmptyState: Bool {
        guard viewModel.localItems.favorites.isEmpty,
              viewModel.localItems.searches.isEmpty,
              viewModel.accountState == .idle else { return false }
        if case .signedOut = viewModel.session { return true }
        return false
    }
}

private struct SavedFavoriteRow: View {
    let name: String
    let detail: String
    let remove: () -> Void

    var body: some View {
        HStack {
            VStack(alignment: .leading) {
                Text(name).font(.headline)
                if !detail.isEmpty { Text(detail).font(.subheadline).foregroundStyle(.secondary) }
            }
            Spacer()
            Button("Remover", systemImage: "trash", action: remove).labelStyle(.iconOnly)
                .accessibilityLabel("Remover favorito")
        }
    }
}

private struct SavedSearchRow: View {
    let summary: String
    let alertEnabled: Bool?
    let setAlert: (Bool) -> Void
    let remove: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label(summary, systemImage: "line.3.horizontal.decrease.circle")
                Spacer()
                Button("Remover", systemImage: "trash", action: remove).labelStyle(.iconOnly)
                    .accessibilityLabel("Remover busca salva")
            }
            if alertEnabled == true {
                Text("Alerta salvo, mas entrega ainda indisponível.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
    }
}
