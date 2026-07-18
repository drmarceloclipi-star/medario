import Foundation

enum NativeNotificationEvent: String, CaseIterable, Sendable {
    case appointmentConfirmed = "appointment_confirmed"
    case profileUpdated = "profile_updated"
    case savedSearchMaterial = "saved_search_material"

    var displayName: String {
        switch self {
        case .appointmentConfirmed: "Atualizações de agendamento"
        case .profileUpdated: "Atualizações de perfis salvos"
        case .savedSearchMaterial: "Novidades em buscas salvas"
        }
    }
}

struct NativeNotificationPreferences: Equatable, Sendable {
    private var pushEvents: Set<NativeNotificationEvent> = []

    func pushEnabled(for event: NativeNotificationEvent) -> Bool { pushEvents.contains(event) }

    mutating func setPush(_ enabled: Bool, for event: NativeNotificationEvent) {
        if enabled { pushEvents.insert(event) } else { pushEvents.remove(event) }
    }

    var hasEnabledPush: Bool { !pushEvents.isEmpty }

    var callablePayload: [String: Any] {
        Dictionary(uniqueKeysWithValues: NativeNotificationEvent.allCases.map { event in
            (event.rawValue, ["push": pushEnabled(for: event)])
        })
    }

    static func fromCallable(_ value: Any) -> NativeNotificationPreferences {
        let root = value as? [String: Any] ?? [:]
        var result = NativeNotificationPreferences()
        for event in NativeNotificationEvent.allCases {
            let record = root[event.rawValue] as? [String: Any]
            result.setPush(record?["push"] as? Bool == true, for: event)
        }
        return result
    }
}
