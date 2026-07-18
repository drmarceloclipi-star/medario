import Observation

@MainActor
@Observable
final class AppointmentOptionsViewModel {
    enum State {
        case idle
        case loading
        case loaded(AppointmentOptions)
        case failed(String)
    }

    private let repository: any AppointmentRepository
    private let sessionSource: any SavedItemsSessionSource
    private(set) var state: State = .idle
    private(set) var bookingSlotID: String?
    private(set) var feedback: String?

    init(repository: any AppointmentRepository, sessionSource: any SavedItemsSessionSource) {
        self.repository = repository
        self.sessionSource = sessionSource
    }

    var session: AccountSession { sessionSource.currentSession }

    func load(slug: String) async {
        guard case .loading = state else {
            state = .loading
            do { state = .loaded(try await repository.publicOptions(slug: slug)) }
            catch { state = .failed("Não foi possível consultar a agenda agora.") }
            return
        }
    }

    func book(slot: AppointmentSlot, type: AppointmentTypeOption, options: AppointmentOptions) async {
        guard bookingSlotID == nil else { return }
        guard case let .signedIn(user) = session else {
            feedback = "Entre na aba Conta antes de reservar."
            return
        }
        guard user.emailVerified else {
            feedback = "Confirme seu e-mail na aba Conta antes de reservar."
            return
        }
        bookingSlotID = slot.id
        defer { bookingSlotID = nil }
        do {
            let result = try await repository.request(doctorID: options.doctorID, typeID: type.id, slotID: slot.id, expectedUserID: user.id)
            feedback = result.status == .confirmed
                ? "Consulta confirmada. Veja detalhes na aba Agenda."
                : "Solicitação enviada. Acompanhe na aba Agenda."
            await loadFresh(slug: options.doctorSlug)
        } catch {
            feedback = "Horário não reservado. Atualize a agenda e tente novamente."
        }
    }

    func clearFeedback() { feedback = nil }

    private func loadFresh(slug: String) async {
        do { state = .loaded(try await repository.publicOptions(slug: slug)) }
        catch { state = .failed("Reserva registrada, mas a agenda não pôde ser atualizada.") }
    }
}
