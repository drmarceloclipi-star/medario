struct AccountFeedback: Equatable {
    enum Kind: Equatable {
        case success
        case error
        case information
    }

    let kind: Kind
    let message: String
}
