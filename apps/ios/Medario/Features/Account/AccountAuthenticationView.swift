import SwiftUI

struct AccountAuthenticationView: View {
    @Bindable var viewModel: AccountViewModel
    @FocusState private var focusedField: Field?

    var body: some View {
        Form {
            Section {
                Text(viewModel.mode == .signIn ? "Entrar no Medário" : "Criar conta de paciente")
                    .font(.title2)
                    .fontDesign(.serif)
                    .bold()
                    .foregroundStyle(MedarioTheme.navy)
                    .accessibilityAddTraits(.isHeader)
                Text("Visitantes continuam podendo buscar no diretório sem conta.")
                    .foregroundStyle(.secondary)
            }

            Section("Acesso") {
                TextField("E-mail", text: $viewModel.email)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .focused($focusedField, equals: .email)
                    .submitLabel(.next)
                    .onSubmit { focusedField = .password }

                SecureField("Senha", text: $viewModel.password)
                    .textContentType(viewModel.mode == .register ? .newPassword : .password)
                    .focused($focusedField, equals: .password)
                    .submitLabel(.go)
                    .onSubmit(authenticate)

                Button(
                    viewModel.mode == .signIn ? "Entrar" : "Criar conta",
                    action: authenticate
                )
                .buttonStyle(.borderedProminent)
                .disabled(viewModel.isAuthenticating)

                if viewModel.isAuthenticating {
                    ProgressView("Aguarde…")
                }
            }

            Section {
                Button(
                    viewModel.mode == .signIn ? "Criar conta" : "Já tenho conta",
                    action: viewModel.toggleMode
                )
                .disabled(viewModel.isAuthenticating)
            }

            if let feedback = viewModel.feedback {
                Section {
                    AccountStatusView(feedback: feedback)
                }
            }
        }
    }

    private func authenticate() {
        focusedField = nil
        Task { await viewModel.authenticate() }
    }
}

private extension AccountAuthenticationView {
    enum Field {
        case email
        case password
    }
}
