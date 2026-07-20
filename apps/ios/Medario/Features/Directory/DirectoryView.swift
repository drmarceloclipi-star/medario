import SwiftUI

struct DirectoryView: View {
    private enum PresentationMode { case list, map }

    @State private var viewModel: DirectoryViewModel
    @Bindable var savedItemsViewModel: SavedItemsViewModel
    private let appointmentRepository: any AppointmentRepository
    private let appointmentSessionSource: any SavedItemsSessionSource
    @State private var query = ""
    @State private var criteria = SavedSearchCriteria()
    @State private var showingFilters = false
    @State private var presentationMode: PresentationMode = .list
    @State private var path = NavigationPath()
    @Binding private var deepLinkSlug: String?

    init(
        viewModel: DirectoryViewModel,
        savedItemsViewModel: SavedItemsViewModel,
        appointmentRepository: any AppointmentRepository,
        appointmentSessionSource: any SavedItemsSessionSource,
        deepLinkSlug: Binding<String?>
    ) {
        _viewModel = State(initialValue: viewModel)
        self.savedItemsViewModel = savedItemsViewModel
        self.appointmentRepository = appointmentRepository
        self.appointmentSessionSource = appointmentSessionSource
        _deepLinkSlug = deepLinkSlug
    }

    var body: some View {
        NavigationStack(path: $path) {
            ZStack {
                MedarioTheme.paper.ignoresSafeArea()
                content
            }
            .navigationTitle("Diretório médico")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Text("Medário")
                        .font(.title2)
                        .fontDesign(.serif)
                        .bold()
                        .foregroundStyle(MedarioTheme.navy)
                        .accessibilityAddTraits(.isHeader)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Filtros", systemImage: criteria.isEmpty ? "line.3.horizontal.decrease.circle" : "line.3.horizontal.decrease.circle.fill") {
                        showingFilters = true
                    }
                    .labelStyle(.iconOnly)
                    .accessibilityHint("Filtra e permite salvar critérios objetivos")
                }
                ToolbarItem(placement: .topBarLeading) {
                    Button(presentationMode == .list ? "Mostrar mapa" : "Mostrar lista", systemImage: presentationMode == .list ? "map" : "list.bullet") {
                        presentationMode = presentationMode == .list ? .map : .list
                    }
                    .labelStyle(.iconOnly)
                }
            }
            .navigationDestination(for: PublicProfile.self) { profile in
                ProfileDetailView(
                    profile: profile,
                    savedItemsViewModel: savedItemsViewModel,
                    appointmentRepository: appointmentRepository,
                    appointmentSessionSource: appointmentSessionSource
                )
            }
            .searchable(text: $query, prompt: "Especialidade, médico ou convênio")
            .onSubmit(of: .search, submitSearch)
            .sheet(isPresented: $showingFilters) {
                DirectoryFiltersView(criteria: $criteria, savedItemsViewModel: savedItemsViewModel) {
                    showingFilters = false
                    Task { await viewModel.load(query: query, criteria: criteria) }
                }
            }
            .task {
                guard case .idle = viewModel.state else { return }
                await viewModel.load()
            }
            .onChange(of: deepLinkSlug) { openDeepLinkIfPossible() }
            .onChange(of: viewModel.state) { openDeepLinkIfPossible() }
            .safeAreaInset(edge: .top) {
                if !viewModel.derivedCriteria.isEmpty {
                    DerivedFilterChipsView(derivedCriteria: viewModel.derivedCriteria) {
                        Task { await viewModel.removeDerivedSpecialty() }
                    } onRemoveDoctor: {
                        Task { await viewModel.removeDerivedDoctor() }
                    } onRemoveCity: {
                        Task { await viewModel.removeDerivedCity() }
                    } onRemoveInsurance: {
                        Task { await viewModel.removeDerivedInsurance() }
                    } onRemoveModality: {
                        Task { await viewModel.removeDerivedModality() }
                    }
                    .padding(.horizontal)
                }
            }
            .alert("Atendimento imediato", isPresented: urgentAlertBinding) {
                Button("Ligar 192", action: callEmergency)
                Button("Entendi", role: .cancel, action: dismissUrgencyAlert)
            } message: {
                if case .urgent(let message) = viewModel.state {
                    Text(message)
                }
            }
            .safeAreaInset(edge: .bottom) {
                if let feedback = savedItemsViewModel.feedback {
                    Text(feedback)
                        .font(.footnote)
                        .padding(10)
                        .frame(maxWidth: .infinity)
                        .background(.thinMaterial)
                        .onTapGesture { savedItemsViewModel.clearFeedback() }
                }
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .idle, .loading, .urgent:
            ProgressView("Carregando diretório…")
                .controlSize(.large)
                .accessibilityLabel("Carregando diretório médico")
        case let .loaded(profiles) where profiles.isEmpty:
            ContentUnavailableView {
                Label("Nenhum perfil encontrado", systemImage: "magnifyingglass")
            } description: {
                Text("Tente outro médico, especialidade, cidade ou convênio.")
            } actions: {
                Button("Limpar busca", action: clearSearch)
            }
        case let .loaded(profiles):
            if presentationMode == .map {
                DirectoryMapView(profiles: profiles) { profile in path.append(profile) }
            } else {
                DirectoryResultsView(profiles: profiles, savedItemsViewModel: savedItemsViewModel)
            }
        case .needsClarification:
            ContentUnavailableView {
                Label("Esclareça sua busca", systemImage: "questionmark.circle")
            } description: {
                Text("Não conseguimos identificar uma especialidade. Tente novamente com mais detalhes.")
            } actions: {
                Button("Limpar busca", action: clearSearch)
            }
        case let .failed(message):
            ContentUnavailableView {
                Label("Diretório indisponível", systemImage: "wifi.exclamationmark")
            } description: {
                Text(message)
            } actions: {
                Button("Tentar novamente", action: retry)
                    .buttonStyle(.borderedProminent)
            }
        }
    }

    private func submitSearch() {
        Task { await viewModel.load(query: query, criteria: criteria) }
    }

    private func clearSearch() {
        query = ""
        criteria = SavedSearchCriteria()
        Task { await viewModel.load() }
    }

    private func retry() {
        Task { await viewModel.retry() }
    }

    private func callEmergency() {
        if let url = URL(string: "tel:192") {
            UIApplication.shared.open(url)
        }
    }

    private func dismissUrgencyAlert() {
        query = ""
        criteria = SavedSearchCriteria()
        Task { await viewModel.dismissUrgency() }
    }

    private var urgentAlertBinding: Binding<Bool> {
        Binding(
            get: {
                if case .urgent = viewModel.state { return true }
                return false
            },
            set: { _ in }
        )
    }

    private func openDeepLinkIfPossible() {
        guard let slug = deepLinkSlug,
              case let .loaded(profiles) = viewModel.state else { return }
        if let profile = profiles.first(where: { $0.slug == slug }) {
            path = NavigationPath()
            path.append(profile)
            deepLinkSlug = nil
            return
        }
        guard !query.isEmpty || !criteria.isEmpty else {
            deepLinkSlug = nil
            return
        }
        query = ""
        criteria = SavedSearchCriteria()
        Task { await viewModel.load() }
    }
}

private struct DirectoryFiltersView: View {
    @Binding var criteria: SavedSearchCriteria
    @Bindable var savedItemsViewModel: SavedItemsViewModel
    let apply: () -> Void

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Especialidade", text: optionalBinding(\.specialty))
                        .textContentType(.jobTitle)
                    TextField("Cidade", text: optionalBinding(\.city))
                        .textContentType(.addressCity)
                    TextField("Convênio", text: optionalBinding(\.insurance))
                    Picker("Modalidade", selection: $criteria.modality) {
                        Text("Qualquer").tag(SavedSearchModality?.none)
                        ForEach(SavedSearchModality.allCases, id: \.self) { modality in
                            Text(modality.displayName).tag(Optional(modality))
                        }
                    }
                } header: {
                    Text("Filtros objetivos")
                } footer: {
                    Text("Texto livre da busca, sintomas e localização exata nunca entram em buscas salvas.")
                }
                Section {
                    Button("Aplicar filtros", action: apply)
                    Button("Salvar esta busca") { savedItemsViewModel.saveSearch(criteria) }
                        .disabled(criteria.isEmpty)
                }
            }
            .navigationTitle("Filtros")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Limpar") { criteria = SavedSearchCriteria() }
                }
            }
        }
    }

    private func optionalBinding(_ keyPath: WritableKeyPath<SavedSearchCriteria, String?>) -> Binding<String> {
        Binding(
            get: { criteria[keyPath: keyPath] ?? "" },
            set: {
                let limited = String($0.prefix(100))
                criteria[keyPath: keyPath] = limited.isEmpty ? nil : limited
            }
        )
    }
}

private struct DerivedFilterChipsView: View {
    let derivedCriteria: SavedSearchCriteria
    let onRemoveSpecialty: () -> Void
    let onRemoveDoctor: () -> Void
    let onRemoveCity: () -> Void
    let onRemoveInsurance: () -> Void
    let onRemoveModality: () -> Void

    var body: some View {
        HStack(spacing: 8) {
            if derivedCriteria.doctorSlug != nil {
                derivedChip(label: "Médico", icon: "person.fill", action: onRemoveDoctor)
            }
            if let specialty = derivedCriteria.specialty {
                derivedChip(label: specialty, icon: "sparkles", action: onRemoveSpecialty)
            }
            if let city = derivedCriteria.city {
                derivedChip(label: city, icon: "mappin.circle.fill", action: onRemoveCity)
            }
            if let insurance = derivedCriteria.insurance {
                derivedChip(label: insurance, icon: "shield.fill", action: onRemoveInsurance)
            }
            if let modality = derivedCriteria.modality {
                derivedChip(label: modality.displayName, icon: "video.fill", action: onRemoveModality)
            }
        }
    }

    private func derivedChip(label: String, icon: String, action: @escaping () -> Void) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.caption)
                .foregroundStyle(MedarioTheme.joinvilleBlue)
            Text(label)
                .font(.caption)
                .fontWeight(.medium)
            Button(action: action) {
                Image(systemName: "xmark.circle.fill")
                    .foregroundStyle(.secondary)
                    .font(.caption)
            }
            .accessibilityLabel("Remover filtro derivado \(label)")
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Capsule().fill(MedarioTheme.joinvilleBlue.opacity(0.12)))
    }
}
