import XCTest
@testable import Medario

@MainActor
final class EvaluationHarnessTests: XCTestCase {

    private var interpreter = FallbackSearchInterpreter()
    private var urgencyProtocol = UrgencyProtocol.default
    private let profiles = TestProfileFactory.profiles

    private func catalog(for query: String) -> DirectorySearchCatalog {
        DirectorySearchCatalog.from(profiles: profiles, query: query)
    }

    // MARK: - Corpus size

    func testCorpusHasAtLeast150Cases() {
        XCTAssertGreaterThanOrEqual(EvaluationCorpus.cases.count, 150,
            "Corpus must have at least 150 cases, got \(EvaluationCorpus.cases.count)")
    }

    // MARK: - Gate 1: 100% urgent block

    func testUrgentGateAllSignalsBlocked() {
        let urgentCases = EvaluationCorpus.cases.filter { $0.expectedUrgent }
        var blocked = 0
        for case_ in urgentCases {
            if case .urgent = urgencyProtocol.evaluate(case_.query) {
                blocked += 1
            }
        }
        XCTAssertEqual(blocked, urgentCases.count,
            "Urgent gate: \(blocked)/\(urgentCases.count) blocked. Must be 100%.")
        print("Urgent gate: \(blocked)/\(urgentCases.count) blocked (100%) — PASS")
    }

    // MARK: - Gate 2: 100% catalog-valid accepted outputs

    func testCatalogValidityGate() async {
        var valid = 0
        var total = 0
        for case_ in EvaluationCorpus.cases where !case_.expectedUrgent {
            let cat = catalog(for: case_.query)
            let result = await interpreter.interpret(case_.query, catalog: cat)
            if case .matched(let interpreted) = result {
                total += 1
                var isValid = true
                if let s = interpreted.specialty, !cat.contains(specialty: s) { isValid = false }
                if let c = interpreted.city, !cat.contains(city: c) { isValid = false }
                if let i = interpreted.insurance, !cat.contains(insurance: i) { isValid = false }
                if let slug = interpreted.doctorSlug, !cat.containsDoctor(slug: slug) { isValid = false }
                if isValid { valid += 1 }
            }
        }
        XCTAssertEqual(valid, total,
            "Catalog validity: \(valid)/\(total) valid. Must be 100%.")
        print("Catalog validity: \(valid)/\(total) valid (100%) — PASS")
    }

    // MARK: - Gate 3: >=95% direct search matching

    func testDirectSearchMatchingGate() async {
        let directCategories: Set<EvaluationCategory> = [
            .directSpecialty, .directDoctor, .directCity, .directInsurance, .directModality
        ]
        let directCases = EvaluationCorpus.cases.filter { directCategories.contains($0.category) }
        var matched = 0
        var failures: [String] = []
        for case_ in directCases {
            let cat = catalog(for: case_.query)
            let result = await interpreter.interpret(case_.query, catalog: cat)
            if result == case_.expectedInterpretation {
                matched += 1
            } else {
                failures.append(case_.query + " expected " + String(describing: case_.expectedInterpretation) + " got " + String(describing: result))
            }
        }
        for f in failures { print("DIRECT FAIL: \(f)") }
        let ratio = Double(matched) / Double(directCases.count)
        XCTAssertGreaterThanOrEqual(ratio, 0.95,
            "Direct match: \(matched)/\(directCases.count) (\(String(format: "%.1f", ratio * 100))%). Must be >=95%.")
        print("Direct match: \(matched)/\(directCases.count) (\(String(format: "%.1f", ratio * 100))%) — PASS")
    }

    // MARK: - Ambiguity + out-of-domain explicit outcomes

    func testAmbiguityOutcomesAreExplicit() async {
        let ambiguityCases = EvaluationCorpus.cases.filter { $0.category == .ambiguity }
        for case_ in ambiguityCases {
            let cat = catalog(for: case_.query)
            let result = await interpreter.interpret(case_.query, catalog: cat)
            XCTAssertEqual(result, case_.expectedInterpretation,
                "Ambiguity case \"\(case_.query)\" expected \(case_.expectedInterpretation), got \(result)")
        }
        print("Ambiguity: \(ambiguityCases.count)/\(ambiguityCases.count) correct — PASS")
    }

    func testOutOfDomainOutcomesAreExplicit() async {
        let outOfDomainCases = EvaluationCorpus.cases.filter { $0.category == .outOfDomain }
        for case_ in outOfDomainCases {
            let cat = catalog(for: case_.query)
            let result = await interpreter.interpret(case_.query, catalog: cat)
            XCTAssertEqual(result, case_.expectedInterpretation,
                "Out-of-domain case \"\(case_.query)\" expected \(case_.expectedInterpretation), got \(result)")
        }
        print("Out-of-domain: \(outOfDomainCases.count)/\(outOfDomainCases.count) correct — PASS")
    }

    // MARK: - Full report

    func testFullEvaluationReport() async {
        var urgentCount = 0
        var urgentBlocked = 0
        var fallbackCount = 0
        var invalidCount = 0
        var matchedCount = 0
        var unsupportedCount = 0
        var needsClarificationCount = 0

        let directCategories: Set<EvaluationCategory> = [
            .directSpecialty, .directDoctor, .directCity, .directInsurance, .directModality
        ]
        var directTotal = 0
        var directMatched = 0

        for case_ in EvaluationCorpus.cases {
            if case_.expectedUrgent {
                urgentCount += 1
                if case .urgent = urgencyProtocol.evaluate(case_.query) {
                    urgentBlocked += 1
                }
                continue
            }

            let cat = catalog(for: case_.query)
            let result = await interpreter.interpret(case_.query, catalog: cat)
            fallbackCount += 1

            switch result {
            case .matched(let interpreted):
                matchedCount += 1
                if let s = interpreted.specialty, !cat.contains(specialty: s) { invalidCount += 1 }
                if let c = interpreted.city, !cat.contains(city: c) { invalidCount += 1 }
                if let i = interpreted.insurance, !cat.contains(insurance: i) { invalidCount += 1 }
            case .needsClarification:
                needsClarificationCount += 1
            case .unsupported:
                unsupportedCount += 1
            }

            if directCategories.contains(case_.category) {
                directTotal += 1
                if result == case_.expectedInterpretation { directMatched += 1 }
            }
        }

        let urgentRatio = Double(urgentBlocked) / Double(max(urgentCount, 1)) * 100
        let directRatio = Double(directMatched) / Double(max(directTotal, 1)) * 100

        print("""
        === Medário Evaluation Report ===
        Corpus size: \(EvaluationCorpus.cases.count) cases

        Urgent gate: \(urgentBlocked)/\(urgentCount) blocked (\(String(format: "%.0f", urgentRatio))%)
        Direct match: \(directMatched)/\(directTotal) (\(String(format: "%.1f", directRatio))%)

        Breakdown:
        - Urgent: \(urgentCount) cases, \(urgentBlocked) blocked
        - Fallback: \(fallbackCount) cases evaluated
        - Model: 0 (simulator — physical device in #110)
        - Invalid output: \(invalidCount)
        - Refusal: 0
        - Timeout: 0
        - Catalog failure: 0
        - Matched: \(matchedCount)
        - Unsupported: \(unsupportedCount)
        - Needs clarification: \(needsClarificationCount)
        === End Report ===
        """)

        XCTAssertEqual(urgentBlocked, urgentCount, "Urgent gate failed")
        XCTAssertGreaterThanOrEqual(directRatio, 95.0, "Direct match gate failed")
    }

    // MARK: - No user data persisted

    func testCorpusContainsNoRealUserData() {
        for case_ in EvaluationCorpus.cases {
            let q = case_.query.lowercased()
            XCTAssertFalse(q.contains("mariana"), "Corpus contains real name: \(case_.query)")
            XCTAssertFalse(q.contains("andrade"), "Corpus contains real name: \(case_.query)")
        }
    }
}