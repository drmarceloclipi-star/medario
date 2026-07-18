import SwiftUI

struct ProfileRowView: View {
    let profile: PublicProfile

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                Text(profile.name)
                    .font(.headline)
                    .foregroundStyle(MedarioTheme.navy)
                Spacer()
                if profile.verified {
                    Label("Verificado", systemImage: "checkmark.seal.fill")
                        .font(.caption)
                        .foregroundStyle(MedarioTheme.joinvilleBlue)
                }
            }
            Text([profile.specialty, profile.crm].filter { !$0.isEmpty }.joined(separator: " · "))
                .font(.subheadline)
                .foregroundStyle(MedarioTheme.text)
            Label(profile.location.summary, systemImage: "mappin.and.ellipse")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Text(profile.availability)
                .font(.subheadline)
                .foregroundStyle(MedarioTheme.navy)
        }
        .padding(.vertical, 8)
    }
}
