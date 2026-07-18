import SwiftUI

struct DirectoryResultsView: View {
    let profiles: [PublicProfile]
    @Bindable var savedItemsViewModel: SavedItemsViewModel

    var body: some View {
        List(profiles) { profile in
            HStack(spacing: 12) {
                NavigationLink(value: profile) {
                    ProfileRowView(profile: profile)
                }
                Button {
                    savedItemsViewModel.toggleFavorite(profile)
                } label: {
                    Image(systemName: savedItemsViewModel.isFavorite(profile.id) ? "heart.fill" : "heart")
                }
                .buttonStyle(.borderless)
                .foregroundStyle(savedItemsViewModel.isFavorite(profile.id) ? .red : MedarioTheme.joinvilleBlue)
                .accessibilityLabel(savedItemsViewModel.isFavorite(profile.id) ? "Remover \(profile.name) dos favoritos" : "Favoritar \(profile.name)")
            }
            .listRowBackground(Color.white)
            .accessibilityHint("Abre o perfil médico")
        }
        .scrollContentBackground(.hidden)
        .accessibilityLabel("Resultados do diretório")
    }
}
