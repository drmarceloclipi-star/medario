import Foundation

enum DirectoryLoadState: Equatable {
    case idle
    case loading
    case loaded([PublicProfile])
    case failed(String)
    case urgent(String)
    case needsClarification
}
