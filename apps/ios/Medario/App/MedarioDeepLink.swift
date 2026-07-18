import Foundation

enum MedarioDeepLink: Equatable, Sendable {
    case profile(slug: String)

    nonisolated static func parse(_ url: URL) -> MedarioDeepLink? {
        let components = url.pathComponents.filter { $0 != "/" }
        let slug: String?
        if url.scheme == "https", url.host?.lowercased() == "medario.com.br" {
            slug = profileSlug(in: components)
        } else if url.scheme == "medario" {
            let route = ([url.host].compactMap { $0 } + components)
            slug = profileSlug(in: route)
        } else {
            slug = nil
        }
        guard let slug, isSafeSlug(slug) else { return nil }
        return .profile(slug: slug)
    }

    nonisolated private static func profileSlug(in components: [String]) -> String? {
        guard components.count == 2,
              components[0] == "medicos" || components[0] == "perfil" else { return nil }
        return components[1].removingPercentEncoding
    }

    nonisolated private static func isSafeSlug(_ value: String) -> Bool {
        !value.isEmpty && value.count <= 100 && value.allSatisfy { $0.isLetter || $0.isNumber || $0 == "-" }
    }
}
