import SwiftUI

struct ProfileHeaderView: View {
    let profile: PublicProfile

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if profile.verified {
                Label("Perfil verificado", systemImage: "checkmark.seal.fill")
                    .foregroundStyle(MedarioTheme.joinvilleBlue)
            }
            if profile.claimed {
                Label("Perfil reivindicado", systemImage: "person.crop.circle.badge.checkmark")
                    .foregroundStyle(MedarioTheme.navy)
            }
            Text(profile.name)
                .font(.largeTitle)
                .fontDesign(.serif)
                .foregroundStyle(MedarioTheme.navy)
                .accessibilityAddTraits(.isHeader)
            Text([profile.specialty, profile.crm, profile.rqe].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "))
                .foregroundStyle(MedarioTheme.text)
            if let date = profile.updatedAt {
                Text("Dados atualizados em \(date, format: .dateTime.day().month().year())")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
    }
}
