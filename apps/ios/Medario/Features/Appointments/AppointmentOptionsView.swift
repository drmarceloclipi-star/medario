import SwiftUI

struct AppointmentOptionsView: View {
    let slug: String
    @State var viewModel: AppointmentOptionsViewModel
    @State private var pendingBooking: (AppointmentSlot, AppointmentTypeOption, AppointmentOptions)?

    var body: some View {
        NavigationStack {
            Group {
                switch viewModel.state {
                case .idle, .loading:
                    ProgressView("Consultando agenda…")
                case let .failed(message):
                    ContentUnavailableView("Agenda indisponível", systemImage: "calendar.badge.exclamationmark", description: Text(message))
                case let .loaded(options):
                    optionsContent(options)
                }
            }
            .navigationTitle("Agendar consulta")
            .navigationBarTitleDisplayMode(.inline)
            .task { await viewModel.load(slug: slug) }
            .confirmationDialog("Confirmar solicitação?", isPresented: Binding(get: { pendingBooking != nil }, set: { if !$0 { pendingBooking = nil } }), titleVisibility: .visible) {
                Button("Solicitar este horário") {
                    guard let pendingBooking else { return }
                    self.pendingBooking = nil
                    Task { await viewModel.book(slot: pendingBooking.0, type: pendingBooking.1, options: pendingBooking.2) }
                }
                Button("Cancelar", role: .cancel) { pendingBooking = nil }
            } message: {
                if let pendingBooking {
                    Text("\(pendingBooking.1.label), \(pendingBooking.0.startsAt.formatted(date: .long, time: .shortened)), \(pendingBooking.1.locationLabel). \(pendingBooking.1.cancellationPolicy)")
                }
            }
            .safeAreaInset(edge: .bottom) {
                if let feedback = viewModel.feedback {
                    Text(feedback).font(.footnote).padding(12).frame(maxWidth: .infinity).background(.thinMaterial).accessibilityLabel(feedback)
                }
            }
        }
    }

    @ViewBuilder
    private func optionsContent(_ options: AppointmentOptions) -> some View {
        if !options.calendarAvailable || options.slots.isEmpty {
            ContentUnavailableView("Sem horários confirmados", systemImage: "calendar", description: Text("Agenda sem disponibilidade atual. Tente novamente mais tarde ou use o contato verificado do perfil."))
        } else {
            List(options.types) { type in
                Section {
                    ForEach(options.slots.filter { $0.typeID == type.id }) { slot in
                        Button {
                            pendingBooking = (slot, type, options)
                        } label: {
                            VStack(alignment: .leading, spacing: 5) {
                                Text(slot.startsAt.formatted(date: .abbreviated, time: .shortened)).font(.headline)
                                Text(type.confirmationPolicy == "immediate" ? "Confirmação imediata" : "Confirmação pelo médico").foregroundStyle(.secondary)
                            }
                        }
                        .disabled(viewModel.bookingSlotID != nil)
                        .accessibilityHint("Abre confirmação antes de solicitar")
                    }
                } header: {
                    Text("\(type.label) · \(type.modality.displayName)")
                } footer: {
                    VStack(alignment: .leading, spacing: 4) {
                        if let price = type.priceCents { Text(price, format: .currency(code: "BRL").scale(0.01)) }
                        Text(type.locationLabel)
                        Text(type.cancellationPolicy)
                    }
                }
            }
        }
    }
}
