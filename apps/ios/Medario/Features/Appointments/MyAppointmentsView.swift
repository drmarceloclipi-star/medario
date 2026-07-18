import SwiftUI

struct MyAppointmentsView: View {
    @Bindable var viewModel: MyAppointmentsViewModel
    @State private var pendingCancellation: PatientAppointment?
    @State private var pendingReschedule: PatientAppointment?

    var body: some View {
        NavigationStack {
            content
                .navigationTitle("Agenda")
                .confirmationDialog("Cancelar agendamento?", isPresented: Binding(get: { pendingCancellation != nil }, set: { if !$0 { pendingCancellation = nil } }), titleVisibility: .visible) {
                    Button("Cancelar agendamento", role: .destructive) {
                        guard let appointment = pendingCancellation else { return }
                        pendingCancellation = nil
                        Task { await viewModel.cancel(appointment) }
                    }
                    Button("Manter agendamento", role: .cancel) { pendingCancellation = nil }
                } message: {
                    if let appointment = pendingCancellation { Text(appointment.cancellationPolicy) }
                }
                .sheet(item: $pendingReschedule) { appointment in
                    AppointmentRescheduleView(appointment: appointment, viewModel: viewModel)
                }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.session {
        case .loading:
            ProgressView("Verificando sessão…")
        case .signedOut:
            ContentUnavailableView("Entre para ver sua agenda", systemImage: "person.crop.circle.badge.questionmark", description: Text("Use a aba Conta. Seus dados ficam vinculados à sua sessão."))
        case .signedIn:
            switch viewModel.state {
            case .idle:
                ContentUnavailableView("Carregar agendamentos", systemImage: "calendar")
                    .task { await viewModel.load() }
            case .loading:
                ProgressView("Carregando agendamentos…")
            case let .failed(message):
                ContentUnavailableView { Label("Agenda indisponível", systemImage: "wifi.exclamationmark") } description: { Text(message) } actions: { Button("Tentar novamente") { Task { await viewModel.load() } } }
            case let .loaded(items) where items.isEmpty:
                ContentUnavailableView("Nenhum agendamento", systemImage: "calendar", description: Text("Escolha um médico no Diretório para consultar horários."))
            case let .loaded(items):
                List(items) { appointment in
                    AppointmentRow(
                        appointment: appointment,
                        busy: viewModel.mutatingAppointmentID == appointment.id,
                        cancel: { pendingCancellation = appointment },
                        reschedule: { pendingReschedule = appointment }
                    )
                }
                .refreshable { await viewModel.load() }
            }
        }
    }
}

private struct AppointmentRow: View {
    let appointment: PatientAppointment
    let busy: Bool
    let cancel: () -> Void
    let reschedule: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(appointment.doctorName).font(.headline)
            Text(appointment.typeLabel).font(.subheadline)
            if let startsAt = appointment.startsAt { Label(startsAt.formatted(date: .long, time: .shortened), systemImage: "calendar") }
            Label(appointment.locationLabel, systemImage: appointment.modality == .telemedicine ? "video" : "mappin.and.ellipse")
            Text(appointment.status.displayName).font(.callout).bold().foregroundStyle(appointment.status == .confirmed ? .green : .secondary)
            if appointment.status.canCancel {
                HStack {
                    if appointment.status == .confirmed && !appointment.typeID.isEmpty && !appointment.doctorSlug.isEmpty {
                        Button("Remarcar", action: reschedule).disabled(busy)
                            .accessibilityLabel("Remarcar consulta com \(appointment.doctorName)")
                    }
                    Button("Cancelar", role: .destructive, action: cancel).disabled(busy)
                        .accessibilityLabel("Cancelar consulta com \(appointment.doctorName)")
                }
            }
        }
        .padding(.vertical, 4)
    }
}

private struct AppointmentRescheduleView: View {
    let appointment: PatientAppointment
    @Bindable var viewModel: MyAppointmentsViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var selectedSlot: AppointmentSlot?

    var body: some View {
        NavigationStack {
            Group {
                if let error = viewModel.rescheduleError {
                    ContentUnavailableView("Horários indisponíveis", systemImage: "calendar.badge.exclamationmark", description: Text(error))
                } else if let options = viewModel.rescheduleOptions {
                    let slots = options.slots.filter { $0.typeID == appointment.typeID }
                    if slots.isEmpty {
                        ContentUnavailableView("Sem novo horário", systemImage: "calendar", description: Text("Nenhum horário compatível está confirmado agora."))
                    } else {
                        List(slots) { slot in
                            Button(slot.startsAt.formatted(date: .long, time: .shortened)) { selectedSlot = slot }
                                .accessibilityHint("Abre confirmação da remarcação")
                        }
                    }
                } else {
                    ProgressView("Consultando horários…")
                }
            }
            .navigationTitle("Remarcar")
            .navigationBarTitleDisplayMode(.inline)
            .task { await viewModel.loadRescheduleOptions(for: appointment) }
            .confirmationDialog("Solicitar novo horário?", isPresented: Binding(get: { selectedSlot != nil }, set: { if !$0 { selectedSlot = nil } }), titleVisibility: .visible) {
                Button("Confirmar remarcação") {
                    guard let slot = selectedSlot else { return }
                    selectedSlot = nil
                    Task {
                        await viewModel.reschedule(appointment, to: slot)
                        dismiss()
                    }
                }
                Button("Cancelar", role: .cancel) { selectedSlot = nil }
            } message: {
                if let slot = selectedSlot { Text(slot.startsAt.formatted(date: .long, time: .shortened)) }
            }
        }
    }
}
