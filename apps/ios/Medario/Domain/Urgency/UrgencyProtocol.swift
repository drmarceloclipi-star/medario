import Foundation

nonisolated struct UrgencyProtocol: Sendable {
    let version: String
    let reviewedBy: String
    let signals: [String]
    let message: String

    static let `default` = UrgencyProtocol(
        version: "2026-07",
        reviewedBy: "Responsável clínica do Medário",
        signals: ["dor no peito", "falta de ar", "desmaio", "sangramento intenso"],
        message: "Este relato pode precisar de atendimento imediato. Procure um serviço de urgência ou ligue 192."
    )

    func evaluate(_ text: String) -> UrgencyOutcome {
        let options: NSString.CompareOptions = [.diacriticInsensitive, .caseInsensitive, .widthInsensitive]
        let locale = Locale(identifier: "pt-BR")
        let normalized = text
            .folding(options: options, locale: locale)
            .components(separatedBy: .whitespaces)
            .filter { !$0.isEmpty }
            .joined(separator: " ")
        guard !normalized.isEmpty else { return .notUrgent }
        for signal in signals {
            let normalizedSignal = signal.folding(options: options, locale: locale)
            if normalized.contains(normalizedSignal) {
                return .urgent(message: message)
            }
        }
        return .notUrgent
    }
}

nonisolated enum UrgencyOutcome: Sendable, Equatable {
    case urgent(message: String)
    case notUrgent
}