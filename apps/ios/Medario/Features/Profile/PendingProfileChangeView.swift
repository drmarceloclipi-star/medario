import SwiftUI

struct PendingProfileChangeView: View {
    let message: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Alteração em revisão", systemImage: "clock.badge.exclamationmark")
                .font(.headline)
                .foregroundStyle(MedarioTheme.navy)
            Text(message)
                .foregroundStyle(MedarioTheme.text)
            Text("O perfil público preserva o último dado confirmado até a conferência.")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding()
        .background(MedarioTheme.aqua.opacity(0.35))
        .clipShape(.rect(cornerRadius: 14))
    }
}
