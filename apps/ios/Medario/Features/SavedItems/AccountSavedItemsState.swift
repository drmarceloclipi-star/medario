import Foundation

enum AccountSavedItemsState: Equatable {
    case idle
    case loading
    case loaded(AccountSavedItems)
    case failed(String)
}
