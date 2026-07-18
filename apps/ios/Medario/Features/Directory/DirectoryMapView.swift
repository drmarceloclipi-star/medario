import MapKit
import SwiftUI

struct DirectoryMapView: View {
    let profiles: [PublicProfile]
    let onSelect: (PublicProfile) -> Void

    private var mappedProfiles: [(profile: PublicProfile, coordinate: CLLocationCoordinate2D)] {
        profiles.compactMap { profile in
            guard let value = profile.location.authorizedCoordinates else { return nil }
            return (profile, CLLocationCoordinate2D(latitude: value.latitude, longitude: value.longitude))
        }
    }

    var body: some View {
        if mappedProfiles.isEmpty {
            ContentUnavailableView(
                "Mapa sem locais autorizados",
                systemImage: "map",
                description: Text("Use a lista para continuar. Endereços não autorizados nunca aparecem no mapa.")
            )
        } else {
            Map(initialPosition: .region(region)) {
                ForEach(mappedProfiles, id: \.profile.id) { item in
                    Annotation(item.profile.name, coordinate: item.coordinate) {
                        Button {
                            onSelect(item.profile)
                        } label: {
                            Image(systemName: "stethoscope.circle.fill")
                                .font(.title)
                                .symbolRenderingMode(.palette)
                                .foregroundStyle(Color.white, MedarioTheme.joinvilleBlue)
                                .shadow(radius: 3)
                        }
                        .accessibilityLabel("Abrir perfil de \(item.profile.name)")
                    }
                }
            }
            .mapStyle(.standard(pointsOfInterest: .excludingAll))
            .accessibilityLabel("Mapa dos locais de atendimento autorizados")
        }
    }

    private var region: MKCoordinateRegion {
        let coordinates = mappedProfiles.map(\.coordinate)
        let latitude = coordinates.map(\.latitude).reduce(0, +) / Double(coordinates.count)
        let longitude = coordinates.map(\.longitude).reduce(0, +) / Double(coordinates.count)
        let latitudeDelta = max((coordinates.map(\.latitude).max() ?? latitude) - (coordinates.map(\.latitude).min() ?? latitude), 0.03) * 1.8
        let longitudeDelta = max((coordinates.map(\.longitude).max() ?? longitude) - (coordinates.map(\.longitude).min() ?? longitude), 0.03) * 1.8
        return MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: latitude, longitude: longitude),
            span: MKCoordinateSpan(latitudeDelta: latitudeDelta, longitudeDelta: longitudeDelta)
        )
    }
}
