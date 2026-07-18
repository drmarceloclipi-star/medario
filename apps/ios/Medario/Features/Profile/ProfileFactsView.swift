import SwiftUI

struct ProfileFactsView: View {
    let profile: PublicProfile

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            LabeledContent("Local", value: profile.location.name)
            if !profile.location.summary.isEmpty {
                LabeledContent("Região", value: profile.location.summary)
            }
            if let address = profile.location.visibleAddress {
                LabeledContent("Endereço", value: address)
            }
            if let routeURL = profile.location.routeURL {
                Link(destination: routeURL) {
                    Label("Abrir rota no Apple Maps", systemImage: "arrow.triangle.turn.up.right.diamond")
                }
                .accessibilityHint("Abre navegação em aplicativo externo")
            }
            LabeledContent("Atendimento", value: profile.modalities.map(\.rawValue).joined(separator: " · "))
            LabeledContent("Disponibilidade", value: profile.availability)
            LabeledContent("Convênios") {
                Text(insuranceText)
                    .multilineTextAlignment(.trailing)
            }
        }
        .padding()
        .background(Color.white)
        .clipShape(.rect(cornerRadius: 14))
        .overlay {
            RoundedRectangle(cornerRadius: 14)
                .stroke(MedarioTheme.navy.opacity(0.14))
        }
    }

    private var insuranceText: String {
        guard !profile.insurances.isEmpty else { return "Não informado" }
        return profile.insurances.map {
            $0.confirmed ? "\($0.name) · confirmado" : "\($0.name) · confirme antes"
        }.joined(separator: "\n")
    }
}
