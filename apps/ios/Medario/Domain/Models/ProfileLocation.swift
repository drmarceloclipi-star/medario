import Foundation

struct ProfileLocation: Codable, Hashable, Sendable {
    let name: String
    let address: String?
    let district: String
    let city: String
    let state: String
    let authorized: Bool
    let latitude: Double?
    let longitude: Double?

    nonisolated init(
        name: String,
        address: String?,
        district: String,
        city: String,
        state: String,
        authorized: Bool,
        latitude: Double? = nil,
        longitude: Double? = nil
    ) {
        self.name = name
        self.address = authorized ? address : nil
        self.district = district
        self.city = city
        self.state = state
        self.authorized = authorized
        self.latitude = authorized ? latitude : nil
        self.longitude = authorized ? longitude : nil
    }

    var summary: String {
        [district, city, state].filter { !$0.isEmpty }.joined(separator: " · ")
    }

    var visibleAddress: String? {
        guard authorized else { return nil }
        return address?.trimmingCharacters(in: .whitespacesAndNewlines).nonEmpty
    }

    var authorizedCoordinates: (latitude: Double, longitude: Double)? {
        guard authorized,
              let latitude, (-90 ... 90).contains(latitude),
              let longitude, (-180 ... 180).contains(longitude) else { return nil }
        return (latitude, longitude)
    }

    var routeURL: URL? {
        guard authorized else { return nil }
        let destination: String
        if let coordinates = authorizedCoordinates {
            destination = "\(coordinates.latitude),\(coordinates.longitude)"
        } else if let visibleAddress {
            destination = [visibleAddress, city, state].filter { !$0.isEmpty }.joined(separator: ", ")
        } else {
            return nil
        }
        var components = URLComponents(string: "https://maps.apple.com/")
        components?.queryItems = [URLQueryItem(name: "daddr", value: destination)]
        return components?.url
    }
}

private extension String {
    var nonEmpty: String? { isEmpty ? nil : self }
}
