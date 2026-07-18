import SwiftUI

struct ProfileContactView: View {
    let contacts: ProfileContacts

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Contato verificado")
                .font(.title2)
                .bold()
                .foregroundStyle(MedarioTheme.navy)
            if let whatsApp = contacts.whatsApp {
                Link(destination: whatsApp.url) {
                    Label("Falar por WhatsApp", systemImage: "message.fill")
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.borderedProminent)
            }
            if let phone = contacts.phone {
                Link(destination: phone.url) {
                    Label("Ligar para consultório", systemImage: "phone.fill")
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.bordered)
            }
            if contacts.isEmpty {
                Text("Nenhum canal verificado disponível. Não exibimos contatos sem confirmação.")
                    .foregroundStyle(.secondary)
            }
        }
    }
}
