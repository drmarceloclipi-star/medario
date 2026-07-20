import Foundation
@testable import Medario

struct EvaluationCase: Sendable {
    let query: String
    let category: EvaluationCategory
    let expectedUrgent: Bool
    let expectedInterpretation: SearchInterpretation
    let note: String
}

enum EvaluationCategory: String, Sendable, CaseIterable {
    case urgent
    case directSpecialty
    case directDoctor
    case directCity
    case directInsurance
    case directModality
    case combination
    case ambiguity
    case outOfDomain
    case empty
}

@MainActor
enum EvaluationCorpus {

    static let cases: [EvaluationCase] = buildCases()

    private static func buildCases() -> [EvaluationCase] {
        var result: [EvaluationCase] = []

        // MARK: - Urgent (30 cases)
        let urgentSignals = [
            ("dor no peito", "chest pain"),
            ("falta de ar", "shortness of breath"),
            ("desmaio", "fainting"),
            ("sangramento intenso", "intense bleeding"),
        ]
        for (signal, note) in urgentSignals {
            result.append(.init(query: signal, category: .urgent, expectedUrgent: true,
                               expectedInterpretation: .unsupported, note: note))
            result.append(.init(query: signal.uppercased(), category: .urgent, expectedUrgent: true,
                               expectedInterpretation: .unsupported, note: "\(note) upper"))
            result.append(.init(query: "  \(signal)  ", category: .urgent, expectedUrgent: true,
                               expectedInterpretation: .unsupported, note: "\(note) whitespace"))
            result.append(.init(query: "estou com \(signal) agora", category: .urgent, expectedUrgent: true,
                               expectedInterpretation: .unsupported, note: "\(note) embedded"))
            result.append(.init(query: "minha mãe tem \(signal) há horas", category: .urgent, expectedUrgent: true,
                               expectedInterpretation: .unsupported, note: "\(note) in sentence"))
            result.append(.init(query: String(signal.map { $0 == "ã" ? "a" : $0 == "ç" ? "c" : $0 }),
                               category: .urgent, expectedUrgent: true,
                               expectedInterpretation: .unsupported, note: "\(note) no diacritics"))
        }
        // Extra: combined urgent
        result.append(.init(query: "dor no peito e falta de ar", category: .urgent, expectedUrgent: true,
                           expectedInterpretation: .unsupported, note: "two urgent signals"))

        // MARK: - Direct specialty (30 cases)
        let specialties = TestProfileFactory.specialties
        for (i, specialty) in specialties.enumerated() {
            result.append(.init(query: specialty, category: .directSpecialty, expectedUrgent: false,
                               expectedInterpretation: .matched(InterpretedSearch(specialty: specialty)),
                               note: "exact specialty #\(i)"))
            result.append(.init(query: specialty.lowercased(), category: .directSpecialty, expectedUrgent: false,
                               expectedInterpretation: .matched(InterpretedSearch(specialty: specialty)),
                               note: "lowercase #\(i)"))
            result.append(.init(query: "preciso de \(specialty)", category: .directSpecialty, expectedUrgent: false,
                               expectedInterpretation: .matched(InterpretedSearch(specialty: specialty)),
                               note: "embedded #\(i)"))
        }
        result.append(.init(query: "cardio", category: .directSpecialty, expectedUrgent: false,
                           expectedInterpretation: .matched(InterpretedSearch(specialty: "Cardiologia")),
                           note: "substring cardio"))
        result.append(.init(query: "dermato", category: .directSpecialty, expectedUrgent: false,
                           expectedInterpretation: .matched(InterpretedSearch(specialty: "Dermatologia")),
                           note: "substring dermato"))
        result.append(.init(query: "pediatra", category: .directSpecialty, expectedUrgent: false,
                           expectedInterpretation: .unsupported,
                           note: "pediatra - not substring match"))
        result.append(.init(query: "ortopedia", category: .directSpecialty, expectedUrgent: false,
                           expectedInterpretation: .matched(InterpretedSearch(specialty: "Ortopedia")),
                           note: "exact orto"))
        result.append(.init(query: "ginecologista", category: .directSpecialty, expectedUrgent: false,
                           expectedInterpretation: .unsupported,
                           note: "ginecologista - not substring match"))
        result.append(.init(query: "neurologista", category: .directSpecialty, expectedUrgent: false,
                           expectedInterpretation: .unsupported,
                           note: "neurologista - not substring match"))
        result.append(.init(query: "oftalmo", category: .directSpecialty, expectedUrgent: false,
                           expectedInterpretation: .matched(InterpretedSearch(specialty: "Oftalmologia")),
                           note: "oftalmo"))
        result.append(.init(query: "urologista", category: .directSpecialty, expectedUrgent: false,
                           expectedInterpretation: .unsupported,
                           note: "urologista - not substring match"))

        // MARK: - Direct doctor (15 cases)
        let doctors = TestProfileFactory.profiles.prefix(5)
        for (i, doctor) in doctors.enumerated() {
            result.append(.init(query: doctor.name, category: .directDoctor, expectedUrgent: false,
                               expectedInterpretation: .matched(InterpretedSearch(doctorSlug: doctor.slug)),
                               note: "exact doctor #\(i)"))
            result.append(.init(query: doctor.name.lowercased(), category: .directDoctor, expectedUrgent: false,
                               expectedInterpretation: .matched(InterpretedSearch(doctorSlug: doctor.slug)),
                               note: "lowercase doctor #\(i)"))
            result.append(.init(query: "quero consultar \(doctor.name)", category: .directDoctor, expectedUrgent: false,
                               expectedInterpretation: .matched(InterpretedSearch(doctorSlug: doctor.slug)),
                               note: "embedded doctor #\(i)"))
        }

        // MARK: - Direct city (15 cases)
        let cities = TestProfileFactory.cities
        for (i, city) in cities.enumerated() {
            result.append(.init(query: city, category: .directCity, expectedUrgent: false,
                               expectedInterpretation: .matched(InterpretedSearch(city: city)),
                               note: "exact city #\(i)"))
            result.append(.init(query: city.lowercased(), category: .directCity, expectedUrgent: false,
                               expectedInterpretation: .matched(InterpretedSearch(city: city)),
                               note: "lowercase city #\(i)"))
            result.append(.init(query: "médico em \(city)", category: .directCity, expectedUrgent: false,
                               expectedInterpretation: .matched(InterpretedSearch(city: city)),
                               note: "embedded city #\(i)"))
        }
        result.append(.init(query: "joinville", category: .directCity, expectedUrgent: false,
                           expectedInterpretation: .matched(InterpretedSearch(city: "Joinville")),
                           note: "joinville lowercase"))
        result.append(.init(query: "floripa", category: .directCity, expectedUrgent: false,
                           expectedInterpretation: .unsupported,
                           note: "slang floripa - not in catalog"))

        // MARK: - Direct insurance (15 cases)
        let insurances = TestProfileFactory.insurances
        for (i, insurance) in insurances.enumerated() {
            result.append(.init(query: insurance, category: .directInsurance, expectedUrgent: false,
                               expectedInterpretation: .matched(InterpretedSearch(insurance: insurance)),
                               note: "exact insurance #\(i)"))
            result.append(.init(query: insurance.lowercased(), category: .directInsurance, expectedUrgent: false,
                               expectedInterpretation: .matched(InterpretedSearch(insurance: insurance)),
                               note: "lowercase insurance #\(i)"))
            result.append(.init(query: "plano \(insurance)", category: .directInsurance, expectedUrgent: false,
                               expectedInterpretation: .matched(InterpretedSearch(insurance: insurance)),
                               note: "embedded insurance #\(i)"))
        }
        result.append(.init(query: "unimed", category: .directInsurance, expectedUrgent: false,
                           expectedInterpretation: .matched(InterpretedSearch(insurance: "Unimed")),
                           note: "unimed lowercase"))
        result.append(.init(query: "sulamerica", category: .directInsurance, expectedUrgent: false,
                           expectedInterpretation: .matched(InterpretedSearch(insurance: "SulAmérica")),
                           note: "sulamerica no diacritics"))

        // MARK: - Direct modality (15 cases)
        result.append(.init(query: "consulta presencial", category: .directModality, expectedUrgent: false,
                           expectedInterpretation: .matched(InterpretedSearch(modality: .inPerson)),
                           note: "presencial"))
        result.append(.init(query: "presencial", category: .directModality, expectedUrgent: false,
                           expectedInterpretation: .matched(InterpretedSearch(modality: .inPerson)),
                           note: "presencial only"))
        result.append(.init(query: "teleconsulta", category: .directModality, expectedUrgent: false,
                           expectedInterpretation: .matched(InterpretedSearch(modality: .telemedicine)),
                           note: "teleconsulta"))
        result.append(.init(query: "telemedicina", category: .directModality, expectedUrgent: false,
                           expectedInterpretation: .matched(InterpretedSearch(modality: .telemedicine)),
                           note: "telemedicina"))
        result.append(.init(query: "consulta online", category: .directModality, expectedUrgent: false,
                           expectedInterpretation: .matched(InterpretedSearch(modality: .telemedicine)),
                           note: "online"))
        result.append(.init(query: "consulta remoto", category: .directModality, expectedUrgent: false,
                           expectedInterpretation: .matched(InterpretedSearch(modality: .telemedicine)),
                           note: "remoto"))
        result.append(.init(query: "presenciais", category: .directModality, expectedUrgent: false,
                           expectedInterpretation: .matched(InterpretedSearch(modality: .inPerson)),
                           note: "presenciais plural"))
        result.append(.init(query: "atendimento presencial", category: .directModality, expectedUrgent: false,
                           expectedInterpretation: .matched(InterpretedSearch(modality: .inPerson)),
                           note: "atendimento presencial"))
        for i in 0..<7 {
            result.append(.init(query: "consulta \(i % 2 == 0 ? "presencial" : "teleconsulta")", category: .directModality,
                               expectedUrgent: false,
                               expectedInterpretation: .matched(InterpretedSearch(modality: i % 2 == 0 ? .inPerson : .telemedicine)),
                               note: "modality #\(i)"))
        }

        // MARK: - Combination (15 cases)
        result.append(.init(query: "Dermatologia em Joinville", category: .combination, expectedUrgent: false,
                           expectedInterpretation: .matched(InterpretedSearch(specialty: "Dermatologia", city: "Joinville")),
                           note: "specialty + city"))
        result.append(.init(query: "Cardiologia Unimed", category: .combination, expectedUrgent: false,
                           expectedInterpretation: .matched(InterpretedSearch(specialty: "Cardiologia", insurance: "Unimed")),
                           note: "specialty + insurance"))
        result.append(.init(query: "Pediatria presencial", category: .combination, expectedUrgent: false,
                           expectedInterpretation: .matched(InterpretedSearch(specialty: "Pediatria", modality: .inPerson)),
                           note: "specialty + modality"))
        result.append(.init(query: "Ortopedia em Curitiba", category: .combination, expectedUrgent: false,
                           expectedInterpretation: .matched(InterpretedSearch(specialty: "Ortopedia", city: "Curitiba")),
                           note: "specialty + city 2"))
        result.append(.init(query: "Psiquiatria teleconsulta", category: .combination, expectedUrgent: false,
                           expectedInterpretation: .matched(InterpretedSearch(specialty: "Psiquiatria", modality: .telemedicine)),
                           note: "specialty + modality 2"))
        result.append(.init(query: "Ginecologia SulAmérica", category: .combination, expectedUrgent: false,
                           expectedInterpretation: .matched(InterpretedSearch(specialty: "Ginecologia", insurance: "SulAmérica")),
                           note: "specialty + insurance 2"))
        result.append(.init(query: "Neurologia em São Paulo", category: .combination, expectedUrgent: false,
                           expectedInterpretation: .matched(InterpretedSearch(specialty: "Neurologia", city: "São Paulo")),
                           note: "specialty + city 3"))
        result.append(.init(query: "Dermatologia Joinville Unimed", category: .combination, expectedUrgent: false,
                           expectedInterpretation: .matched(InterpretedSearch(specialty: "Dermatologia", city: "Joinville", insurance: "Unimed")),
                           note: "specialty + city + insurance"))
        result.append(.init(query: "Cardiologia teleconsulta em Joinville", category: .combination, expectedUrgent: false,
                           expectedInterpretation: .matched(InterpretedSearch(specialty: "Cardiologia", city: "Joinville", modality: .telemedicine)),
                           note: "specialty + city + modality"))
        result.append(.init(query: "Pediatria Bradesco Saúde presencial", category: .combination, expectedUrgent: false,
                           expectedInterpretation: .matched(InterpretedSearch(specialty: "Pediatria", insurance: "Bradesco Saúde", modality: .inPerson)),
                           note: "specialty + insurance + modality"))
        result.append(.init(query: "Oftalmologia em São Paulo SulAmérica", category: .combination, expectedUrgent: false,
                           expectedInterpretation: .matched(InterpretedSearch(specialty: "Oftalmologia", city: "São Paulo", insurance: "SulAmérica")),
                           note: "specialty + city + insurance 2"))
        result.append(.init(query: "Urologia Unimed presencial", category: .combination, expectedUrgent: false,
                           expectedInterpretation: .matched(InterpretedSearch(specialty: "Urologia", insurance: "Unimed", modality: .inPerson)),
                           note: "specialty + insurance + modality 2"))
        result.append(.init(query: "Endocrinologia teleconsulta Amil", category: .combination, expectedUrgent: false,
                           expectedInterpretation: .matched(InterpretedSearch(specialty: "Endocrinologia", insurance: "Amil", modality: .telemedicine)),
                           note: "specialty + modality + insurance"))
        result.append(.init(query: "Ginecologia Curitiba telemedicina", category: .combination, expectedUrgent: false,
                           expectedInterpretation: .matched(InterpretedSearch(specialty: "Ginecologia", city: "Curitiba", modality: .telemedicine)),
                           note: "specialty + city + modality 2"))
        result.append(.init(query: "Cardiologia Florianópolis Bradesco", category: .combination, expectedUrgent: false,
                           expectedInterpretation: .matched(InterpretedSearch(specialty: "Cardiologia", city: "Florianópolis", insurance: "Bradesco Saúde")),
                           note: "specialty + city + insurance 3"))

        // MARK: - Ambiguity (10 cases)
        result.append(.init(query: "consulta", category: .ambiguity, expectedUrgent: false,
                           expectedInterpretation: .unsupported, note: "too generic"))
        result.append(.init(query: "médico", category: .ambiguity, expectedUrgent: false,
                           expectedInterpretation: .unsupported, note: "no criteria"))
        result.append(.init(query: "especialista", category: .ambiguity, expectedUrgent: false,
                           expectedInterpretation: .unsupported, note: "no specific specialty"))
        result.append(.init(query: "quero um médico bom", category: .ambiguity, expectedUrgent: false,
                           expectedInterpretation: .unsupported, note: "subjective"))
        result.append(.init(query: "preciso de ajuda", category: .ambiguity, expectedUrgent: false,
                           expectedInterpretation: .unsupported, note: "no criteria"))
        result.append(.init(query: "consulta geral", category: .ambiguity, expectedUrgent: false,
                           expectedInterpretation: .unsupported, note: "no specific specialty"))
        result.append(.init(query: "clínico geral", category: .ambiguity, expectedUrgent: false,
                           expectedInterpretation: .unsupported, note: "not in catalog"))
        result.append(.init(query: "qualquer especialidade", category: .ambiguity, expectedUrgent: false,
                           expectedInterpretation: .unsupported, note: "explicitly ambiguous"))
        result.append(.init(query: "não sei qual médico", category: .ambiguity, expectedUrgent: false,
                           expectedInterpretation: .unsupported, note: "user unsure"))
        result.append(.init(query: "me recomende um médico", category: .ambiguity, expectedUrgent: false,
                           expectedInterpretation: .unsupported, note: "requesting recommendation"))

        // MARK: - Out of domain (10 cases)
        result.append(.init(query: "restaurante italiano", category: .outOfDomain, expectedUrgent: false,
                           expectedInterpretation: .unsupported, note: "non-medical"))
        result.append(.init(query: "comprar carro", category: .outOfDomain, expectedUrgent: false,
                           expectedInterpretation: .unsupported, note: "non-medical"))
        result.append(.init(query: "previsão do tempo", category: .outOfDomain, expectedUrgent: false,
                           expectedInterpretation: .unsupported, note: "non-medical"))
        result.append(.init(query: "filme do cinema", category: .outOfDomain, expectedUrgent: false,
                           expectedInterpretation: .unsupported, note: "non-medical"))
        result.append(.init(query: "diagnóstico de câncer", category: .outOfDomain, expectedUrgent: false,
                           expectedInterpretation: .unsupported, note: "diagnosis request"))
        result.append(.init(query: "prescrever medicação", category: .outOfDomain, expectedUrgent: false,
                           expectedInterpretation: .unsupported, note: "prescription request"))
        result.append(.init(query: "tratamento para diabetes", category: .outOfDomain, expectedUrgent: false,
                           expectedInterpretation: .unsupported, note: "treatment request"))
        result.append(.init(query: "qual remédio tomar", category: .outOfDomain, expectedUrgent: false,
                           expectedInterpretation: .unsupported, note: "medication advice"))
        result.append(.init(query: "pronóstico médico", category: .outOfDomain, expectedUrgent: false,
                           expectedInterpretation: .unsupported, note: "prognosis request"))
        result.append(.init(query: "receita médica", category: .outOfDomain, expectedUrgent: false,
                           expectedInterpretation: .unsupported, note: "prescription online"))

        // MARK: - Empty/whitespace (5 cases)
        result.append(.init(query: "", category: .empty, expectedUrgent: false,
                           expectedInterpretation: .unsupported, note: "empty"))
        result.append(.init(query: "   ", category: .empty, expectedUrgent: false,
                           expectedInterpretation: .unsupported, note: "whitespace"))
        result.append(.init(query: "\n\n", category: .empty, expectedUrgent: false,
                           expectedInterpretation: .unsupported, note: "newlines"))
        result.append(.init(query: "\t", category: .empty, expectedUrgent: false,
                           expectedInterpretation: .unsupported, note: "tab"))
        result.append(.init(query: " \n\t ", category: .empty, expectedUrgent: false,
                           expectedInterpretation: .unsupported, note: "mixed whitespace"))

        return result
    }
}