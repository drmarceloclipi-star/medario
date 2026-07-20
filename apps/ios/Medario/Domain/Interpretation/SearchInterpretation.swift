import Foundation

nonisolated enum SearchInterpretation: Sendable, Equatable {
    case matched(specialty: String)
    case needsClarification
    case unsupported
}