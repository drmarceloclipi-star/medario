import SwiftUI

struct AccountStatusView: View {
    let feedback: AccountFeedback

    var body: some View {
        Label(feedback.message, systemImage: iconName)
            .foregroundStyle(feedback.kind == .error ? MedarioTheme.floralRed : MedarioTheme.text)
            .accessibilityElement(children: .combine)
            .accessibilityLabel("Status: \(feedback.message)")
    }

    private var iconName: String {
        switch feedback.kind {
        case .success:
            "checkmark.circle.fill"
        case .error:
            "exclamationmark.triangle.fill"
        case .information:
            "info.circle.fill"
        }
    }
}
