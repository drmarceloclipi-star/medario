import Observation

@MainActor
@Observable
final class MyAppointmentsViewModel {
    enum State {
        case idle
        case loading
        case loaded([PatientAppointment])
        case failed(String)
    }

    private let repository: any AppointmentRepository
    @ObservationIgnored private var subscription: (any AccountSessionSubscription)?
    @ObservationIgnored private var generation = 0
    private(set) var session: AccountSession
    private(set) var state: State = .idle
    private(set) var mutatingAppointmentID: String?
    private(set) var rescheduleOptions: AppointmentOptions?
    private(set) var rescheduleError: String?

    init(repository: any AppointmentRepository, sessionSource: any SavedItemsSessionSource) {
        self.repository = repository
        session = sessionSource.currentSession
        subscription = sessionSource.subscribe { [weak self] session in self?.receive(session) }
    }

    func load() async {
        guard case let .signedIn(user) = session, mutatingAppointmentID == nil else { return }
        generation += 1
        let current = generation
        state = .loading
        do {
            let page = try await repository.myAppointments(expectedUserID: user.id)
            guard isCurrent(userID: user.id, generation: current) else { return }
            state = .loaded(page.items)
        } catch {
            guard isCurrent(userID: user.id, generation: current) else { return }
            state = .failed("Não foi possível carregar seus agendamentos.")
        }
    }

    func cancel(_ appointment: PatientAppointment) async {
        guard case let .signedIn(user) = session, mutatingAppointmentID == nil else { return }
        generation += 1
        let current = generation
        mutatingAppointmentID = appointment.id
        defer {
            if isCurrent(userID: user.id, generation: current) { mutatingAppointmentID = nil }
        }
        do {
            _ = try await repository.cancel(appointmentID: appointment.id, expectedUserID: user.id)
            guard isCurrent(userID: user.id, generation: current) else { return }
            let page = try await repository.myAppointments(expectedUserID: user.id)
            guard isCurrent(userID: user.id, generation: current) else { return }
            state = .loaded(page.items)
        } catch {
            guard isCurrent(userID: user.id, generation: current) else { return }
            state = .failed("Cancelamento não concluído. Atualize e tente novamente.")
        }
    }

    func reschedule(_ appointment: PatientAppointment, to slot: AppointmentSlot) async {
        guard case let .signedIn(user) = session, mutatingAppointmentID == nil else { return }
        generation += 1
        let current = generation
        mutatingAppointmentID = appointment.id
        defer {
            if isCurrent(userID: user.id, generation: current) { mutatingAppointmentID = nil }
        }
        do {
            _ = try await repository.reschedule(appointmentID: appointment.id, slotID: slot.id, expectedUserID: user.id)
            guard isCurrent(userID: user.id, generation: current) else { return }
            let page = try await repository.myAppointments(expectedUserID: user.id)
            guard isCurrent(userID: user.id, generation: current) else { return }
            state = .loaded(page.items)
        } catch {
            guard isCurrent(userID: user.id, generation: current) else { return }
            state = .failed("Remarcação não concluída. Escolha outro horário e tente novamente.")
        }
    }

    func loadRescheduleOptions(for appointment: PatientAppointment) async {
        rescheduleOptions = nil
        rescheduleError = nil
        do {
            rescheduleOptions = try await repository.publicOptions(slug: appointment.doctorSlug)
        } catch {
            rescheduleError = "Não foi possível consultar novos horários."
        }
    }

    private func receive(_ next: AccountSession) {
        session = next
        generation += 1
        mutatingAppointmentID = nil
        rescheduleOptions = nil
        rescheduleError = nil
        state = .idle
    }

    private func isCurrent(userID: String, generation: Int) -> Bool {
        guard self.generation == generation, case let .signedIn(user) = session else { return false }
        return user.id == userID
    }
}
