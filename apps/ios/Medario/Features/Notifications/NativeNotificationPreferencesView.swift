import SwiftUI

struct NativeNotificationPreferencesView: View {
    @Bindable var viewModel: NativeNotificationViewModel

    var body: some View {
        Section("Notificações") {
            if viewModel.state == .loading || viewModel.state == .idle {
                ProgressView("Carregando preferências…")
            } else if viewModel.state == .failed {
                ContentUnavailableView("Preferências indisponíveis", systemImage: "bell.slash")
                Button("Tentar novamente") { Task { await viewModel.load() } }
            } else {
                ForEach(NativeNotificationEvent.allCases, id: \.self) { event in
                    Toggle(event.displayName, isOn: Binding(
                        get: { viewModel.preferences.pushEnabled(for: event) },
                        set: { enabled in Task { await viewModel.setPush(enabled, for: event) } }
                    ))
                    .disabled(viewModel.busyEvent != nil)
                }
                Text("Na tela bloqueada, mostramos apenas avisos genéricos. Detalhes ficam dentro do app.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                if let feedback = viewModel.feedback {
                    Text(feedback).font(.footnote).foregroundStyle(.secondary)
                }
            }
        }
        .task { if viewModel.state == .idle { await viewModel.load() } }
    }
}
