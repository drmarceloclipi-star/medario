import SwiftUI

struct ProfileDetailView: View {
    let profile: PublicProfile
    @Bindable var savedItemsViewModel: SavedItemsViewModel
    @State private var appointmentViewModel: AppointmentOptionsViewModel
    @State private var showingAppointments = false

    init(
        profile: PublicProfile,
        savedItemsViewModel: SavedItemsViewModel,
        appointmentRepository: any AppointmentRepository,
        appointmentSessionSource: any SavedItemsSessionSource
    ) {
        self.profile = profile
        self.savedItemsViewModel = savedItemsViewModel
        _appointmentViewModel = State(initialValue: AppointmentOptionsViewModel(repository: appointmentRepository, sessionSource: appointmentSessionSource))
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 24) {
                ProfileHeaderView(profile: profile)
                if let pendingChange = profile.pendingChange {
                    PendingProfileChangeView(message: pendingChange)
                }
                ProfileFactsView(profile: profile)
                Button {
                    showingAppointments = true
                } label: {
                    Label("Ver horários", systemImage: "calendar.badge.plus")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .accessibilityHint("Consulta disponibilidade confirmada antes da reserva")
                ProfileContactView(contacts: profile.contacts)
                if !profile.bio.isEmpty {
                    Text("Sobre")
                        .font(.title2)
                        .bold()
                        .foregroundStyle(MedarioTheme.navy)
                    Text(profile.bio)
                        .foregroundStyle(MedarioTheme.text)
                }
            }
            .padding()
        }
        .background(MedarioTheme.paper)
        .navigationTitle("Perfil médico")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showingAppointments) {
            AppointmentOptionsView(slug: profile.slug, viewModel: appointmentViewModel)
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    savedItemsViewModel.toggleFavorite(profile)
                } label: {
                    Image(systemName: savedItemsViewModel.isFavorite(profile.id) ? "heart.fill" : "heart")
                }
                .accessibilityLabel(savedItemsViewModel.isFavorite(profile.id) ? "Remover \(profile.name) dos favoritos" : "Favoritar \(profile.name)")
            }
        }
    }
}
