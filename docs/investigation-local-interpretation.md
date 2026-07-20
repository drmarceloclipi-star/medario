# Investigation: Interpretação local principal — current state

> **Date:** 2025-07-19
> **Scope:** Read-only codebase investigation grounding issues #103–#110 (Apple Foundation Models interpreted search on iOS)
> **Issues covered:** #103 (PRD), #104 (urgency barrier), #105 (specialty tracer bullet), #106 (doctor/city/insurance/modality), #107 (fallback/unavailability), #108 (derived filters/clarification), #109 (automated pt-BR evaluation), #110 (physical-device validation)
> **Method:** Five parallel read-only investigators covering directory search flow, domain models, repository layer, ADR/documentation, and test infrastructure

---

## 1. Repository structure

| Path | Contents |
|------|----------|
| `apps/ios/Medario/` | App source — 85 Swift files |
| `apps/ios/MedarioTests/` | Unit tests — 27 Swift files |
| `apps/ios/MedarioUITests/` | UI tests — 1 Swift file |
| `apps/ios/Medario.xcodeproj` | Xcode project (XcodeGen-generated) |
| `docs/adr/` | Architecture Decision Records (0001–0004) |
| `apps/web/` | Web app — contains the existing urgency protocol |

**Total app+test Swift files:** 113 (excluding SPM checkouts in `.derived`/`.runtimeData`)

**Branch:** `main`

---

## 2. Architecture at a glance

| Layer | Pattern | Key types |
|-------|---------|-----------|
| **App** | SwiftUI `@main`, 4-tab `RootTab` | `MedarioApp`, `RootView`, `MedarioDeepLink`, `NativePushCoordinator` |
| **Features** | SwiftUI views + `@Observable @MainActor` view models | Directory, SavedItems, Appointments, Account, Notifications, Profile |
| **Domain** | `Sendable` structs/enums, `@MainActor` repository protocols | `PublicProfile`, `SavedSearchCriteria`, `ConsultationModality`, `SavedSearchModality`, `ProfileLocation`, `ProfileInsurance`, `PublicDirectoryRepository` |
| **Data** | Firebase Firestore implementations | `FirebasePublicDirectoryRepository`, `FirestorePublicProfileMapper`, `FirebasePublicProfileDocumentsSource` |
| **Tests** | `XCTestCase` + `@MainActor async`, constructor-injected mocks | `DirectoryViewModelTests`, `MockPublicDirectoryRepository`, `ControlledPublicDirectoryRepository`, `PublicProfileFixture` |
| **CI** | `.github/workflows/ci.yml` — **web/Functions only** on `ubuntu-latest` | **Zero iOS CI** (no macOS runner, no `xcodebuild test`) |

---

## 3. Directory search flow (the fallback path to preserve)

### 3.1 Search submission — step by step

1. **Typing**: `DirectoryView` uses `.searchable(text: $query, prompt: "Especialidade, médico ou convênio")`. No per-keystroke fetch — `query` is plain `@State`.
2. **Submit** (Enter): `.onSubmit(of: .search, submitSearch)` → `submitSearch()` → `Task { await viewModel.load(query: query, criteria: criteria) }`.
3. **Inside `load`** (`DirectoryViewModel`):
   - `generation += 1`; `requestGeneration` snapshot captured
   - `lastQuery` / `lastCriteria` recorded
   - `state = .loading`
   - `await repository.profiles(matching: query)` — cached full-directory fetch + `localizedStandardContains` over `searchableText`
   - Result filtered locally with `.filter { $0.matches(criteria) }`
   - `guard requestGeneration == generation else { return }` — stale results discarded
   - `state = .loaded(profiles)` or `.failed("Não foi possível carregar o diretório. Verifique sua conexão e tente novamente.")`
4. **Render**: `content` switches on `viewModel.state`:
   - `.idle`/`.loading` → `ProgressView`
   - `.loaded([])` → `ContentUnavailableView` + "Limpar busca"
   - `.loaded(profiles)` → `DirectoryResultsView` (list) or `DirectoryMapView` (map)
   - `.failed(msg)` → `ContentUnavailableView` + "Tentar novamente"

### 3.2 DirectoryViewModel internals

- `@Observable @MainActor final class DirectoryViewModel` (not `ObservableObject`/`@Published` — uses `@Observable` macro)
- Observable state: `private(set) var state: DirectoryLoadState`, `lastQuery: String`, `lastCriteria: SavedSearchCriteria`
- Private: `generation = 0` (int counter for stale-result protection)
- Dependency: `repository: any PublicDirectoryRepository` (constructor-injected)
- **No true task cancellation** — previous `Task` runs to completion; result is discarded by generation guard

### 3.3 DirectoryLoadState

```swift
enum DirectoryLoadState: Equatable {
    case idle
    case loading
    case loaded([PublicProfile])
    case failed(String)
}
```

### 3.4 Filter criteria today

```swift
struct SavedSearchCriteria: Codable, Hashable, Sendable {
    var specialty: String?   // free-text, trimmed, ≤100 chars
    var city: String?        // free-text, trimmed, ≤100 chars
    var insurance: String?   // free-text, trimmed, ≤100 chars
    var modality: SavedSearchModality?  // enum
    // No doctor slug field
}

enum SavedSearchModality: String, Codable, CaseIterable, Hashable, Sendable {
    case inPerson = "in_person"       // displayName: "Presencial"
    case telemedicine = "telemedicine" // displayName: "Teleconsulta"
}
```

Matching (`PublicProfile.matches(_:)` private extension in `DirectoryViewModel.swift`):
- `specialty` → `localizedStandardContains`
- `city` → `location.city.localizedStandardContains`
- `insurance` → `insurances.contains(where: { $0.name.localizedStandardContains(insurance) })`
- `modality` → enum membership check on `PublicProfile.modalities`

### 3.5 Filter UI

- **No filter chips, no derived-filter display, no per-criterion removal**
- Modal `DirectoryFiltersView` sheet with TextFields + Picker
- Toolbar icon toggles `line.3.horizontal.decrease.circle` ↔ `.fill` when `criteria` is non-empty
- `SavedSearchCriteria.summary` exists (joins active criteria with " · ") but is **not rendered** anywhere

### 3.6 Other load entry points

- **Initial load**: `.task { guard case .idle = viewModel.state else { return }; await viewModel.load() }` — full fetch on first appear
- **Filters apply**: sheet "Aplicar filtros" → `Task { await viewModel.load(query: query, criteria: criteria) }`
- **Clear search**: resets `query`/`criteria`, then `Task { await viewModel.load() }`
- **Retry**: `viewModel.retry()` → `load(query: lastQuery, criteria: lastCriteria)`
- **Deep-link**: clears query/criteria if deep-link slug not found, reloads

---

## 4. Repository layer

### 4.1 Protocol

```swift
@MainActor
protocol PublicDirectoryRepository {
    func profiles(matching query: String) async throws -> [PublicProfile]
}
```

Single method. Criteria filtering is done by the view model, not the repository.

### 4.2 Implementation (`FirebasePublicDirectoryRepository`)

- Fetches all docs with `published == true && publicReadSafe == true` from Firestore `publicDoctors` collection
- Maps via `FirestorePublicProfileMapper.map(id:data:)`, sorts by `name` ascending (`localizedStandardCompare`)
- Caches in `cachedProfiles: [PublicProfile]?`
- `profiles(matching:)`: trim query → if empty return all → else `filter { $0.searchableText.localizedStandardContains(normalizedQuery) }`
- `invalidateCache()` resets cache (concrete-only, not on protocol)
- Errors: pass-through `throws` — no wrapping, retry, or domain-specific error mapping

### 4.3 PublicProfile.searchableText

```swift
var searchableText: String {
    ([name, specialty, location.city, location.district] + insurances.map(\.name))
        .joined(separator: " ")
}
```

### 4.4 Firestore schema (loosely typed)

| Field | Type | Notes |
|-------|------|-------|
| `published` | Bool | Filtered `== true` |
| `publicReadSafe` | Bool | Filtered `== true` |
| `slug` | String | Falls back to doc ID |
| `name` | String | Falls back to "Perfil médico" |
| `specialty` / `specialties` | String / [String] / {name} | `firstString` accepts any form |
| `crm` | String | |
| `rqe` | String? | |
| `bio` | String | |
| `verified` | Bool | Falls back to `verificationStatus == "verified"` |
| `claimed` | Bool | |
| `location` | [String: Any] | Nested: name, address, district, city, state, authorized, lat, lon |
| `insurances` | [String] / [[String: Any]] | `{name, confirmed | status}` |
| `modalities` / `appointmentTypes` | [String] | Mapped to `ConsultationModality` |
| `contacts` | [String: Any] | `whatsApp`, `phone` — verified + URL-allowlisted |
| `availability` | [String: Any] | `confirmed`, `acceptsNewPatients`, `nextAvailableAt`, freshness ≤300s |

**Everything is stored as strings/loosely-typed values.** Only `ConsultationModality` is an in-app enum, and even it is loosely mapped.

---

## 5. Domain models

### 5.1 PublicProfile

```swift
struct PublicProfile: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let slug: String
    let name: String
    let specialty: String          // single, plain string
    let crm: String
    let rqe: String?
    let bio: String
    let verified: Bool
    let claimed: Bool
    let updatedAt: Date?
    let pendingChange: String?
    let location: ProfileLocation
    let insurances: [ProfileInsurance]
    let modalities: [ConsultationModality]
    let availability: String
    let contacts: ProfileContacts
    var searchableText: String { ... }
}
```

### 5.2 Modality enums (NOT bridged)

| Enum | Context | Raw values | CaseIterable |
|------|---------|------------|--------------|
| `ConsultationModality` | Profile-side | `"Presencial"`, `"Teleconsulta externa"` | ❌ |
| `SavedSearchModality` | Search-side | `"in_person"`, `"telemedicine"` | ✅ |

**No automatic conversion between them exists.** #106 will need a mapping.

### 5.3 Cross-cutting representation

| Concept | On `PublicProfile` | In `SavedSearchCriteria` | In `LocalFavorite` |
|--------|---------------------|--------------------------|---------------------|
| Doctor slug | `slug: String` | **absent** | **absent** (uses `doctorID` = `profile.id`) |
| Specialty | `specialty: String` | `specialty: String?` | `specialty: String` |
| City | `location.city: String` | `city: String?` | `city: String` |
| Insurance | `insurances: [ProfileInsurance]` | `insurance: String?` | **absent** |
| Modality | `modalities: [ConsultationModality]` | `modality: SavedSearchModality?` | **absent** |

### 5.4 ProfileLocation

- Privacy-gated at construction: `authorized == false` → `address`, `latitude`, `longitude` coerced to `nil`
- Computed: `summary` (district · city · state), `visibleAddress`, `authorizedCoordinates`, `routeURL`
- **Note**: synthesized `Codable` init does NOT apply authorization gating — decoded locations could carry unauthorized data. Computed properties re-check defensively.

### 5.5 SavedSearchCriteria (the persisted "objective criteria")

- Four optional fields, no doctor reference, no geo, no date
- `isPersistable`: non-empty AND every present string ≤100 chars
- `summary`: "A · B · C" join for display
- `callablePayload`: dictionary for backend calls with keys `specialty`, `city`, `insurance`, `modality`

---

## 6. Urgency protocol — web reference, iOS absent

### 6.1 Web implementation (`apps/web/app/symptom-protocol.ts`)

```typescript
export const reviewedUrgencyProtocol = {
  version: "2026-07",
  reviewedBy: "Responsável clínica do Medário",
  signals: ["dor no peito", "falta de ar", "desmaio", "sangramento intenso"],
} as const;
```

- **4 urgent signals**: "dor no peito", "falta de ar", "desmaio", "sangramento intenso"
- **Urgent outcome**: `{ kind: "urgent", message: "Este relato pode precisar de atendimento imediato. Procure um serviço de urgência ou ligue 192." }` — empty filters, interrupts search
- **Orientation signals**: "ansiedade"/"depressão"/"crise" → `psiquiatria`; "febre"/"tosse" → `pediatria`
- **Tests**: `symptom-protocol.test.ts` (12 cases) + `quality/symptom-protocol.test.ts` (2 integration tests)

### 6.2 iOS — nothing

- **No urgency protocol, no symptom detection, no alert, no `192` reference** anywhere in Swift code
- `DirectoryViewModel.load()` goes straight to repository — no pre-check
- No `.alert` or `.confirmationDialog` in the search path

### 6.3 Glossary (CONTEXT.md)

| Term | Definition |
|------|-----------|
| Protocolo de alerta de urgência | Clinically reviewed criteria determining when a report generates an urgency alert. Applied deterministically **before** any language model interpretation. |
| Barreira de urgência | Mandatory execution of the urgency alert protocol before local interpretation. Blocked reports do not proceed to the model. |
| Alerta de urgência | Preventive interruption directing to urgency service without concluding a clinical cause. |
| Interpretação local principal | System local language model as interpreter on compatible devices. Foundation Models replaces deterministic parser when available. |
| Degradação da interpretação local | Existing deterministic parser used when Foundation Models unavailable. |
| Saída local validada | Structured output limited to existing catalog identifiers; unknown values rejected. |

---

## 7. ADR-0004 — status "Proposed"

**File:** `docs/adr/0004-apple-foundation-models.md`

| Aspect | Decision |
|--------|----------|
| Role | Foundation Models is the **primary** (not fallback) interpreter on iOS 26+ |
| Urgency protocol | Mandatory, deterministic, runs before any model call — model cannot override |
| Guided generation | Output constrained to existing catalog identifiers; unknown values rejected |
| Immediate application | Valid output opens results without confirmation; derived filters visible/editable/removable |
| Degradation | Existing deterministic parser continues when model unavailable; search never blocked |
| **Unresolved at proposal** | Timeout policy, exact output contract, quality criteria |

**PRD (#103) resolves the open items:**
- 15-second defensive deadline
- At most one specialty + one doctor
- At most 20 doctor candidates preselected locally
- Fresh session per search
- Prewarm after first non-empty character (not at app launch)
- Cancel previous work on new submission
- Reject every response whose generation doesn't match current search

### All ADRs

| Number | Title | Status |
|--------|-------|--------|
| 0001 | Nova aplicação web mobile em monorepo | Aceito |
| 0002 | Jornada contínua entre frontends públicos e de produto | Aceito |
| 0003 | Account erasure tombstones and professional-profile continuity | Accepted |
| 0004 | Apple Foundation Models como intérprete principal da busca no iOS | **Proposed** |

---

## 8. Test infrastructure

### 8.1 Patterns

- **No setUp/tearDown** — each test constructs its own mocks inline
- **`@MainActor async`** tests with direct post-await assertions (no `XCTestExpectation`)
- **Mock injection**: constructor-based (`DirectoryViewModel(repository:)`)
- **Two mock repositories**:
  - `MockPublicDirectoryRepository` — pre-programmed `Result` + spy array `receivedQueries`
  - `ControlledPublicDirectoryRepository` — continuation-based for race-condition testing
- **Fixture**: `PublicProfileFixture.mariana` — single static profile, no builder/parameterization
- **Concurrency test**: `generation` guard tested via `ControlledPublicDirectoryRepository` + `Task` + `Task.yield()` polling helper

### 8.2 Test inventory

| Category | Files |
|----------|-------|
| Directory | `DirectoryViewModelTests`, `MockPublicDirectoryRepository`, `ControlledPublicDirectoryRepository`, `PublicProfileFixture`, `FirebasePublicDirectoryRepositoryTests`, `FirestorePublicProfileMapperTests`, `MockPublicProfileDocumentsSource`, `ProfileLocationTests` |
| Account | 10 files (views, repos, gateways, mappers) |
| Saved Items | 4 files |
| Appointments | 2 files |
| Notifications | 3 files |
| Misc | `MedarioDeepLinkTests`, `ReleaseConfigurationTests`, `TestError` |

### 8.3 UI tests

- `MedarioNativeLaunchUITests.swift` — 2 tests only:
  - `testLaunchesNativeRootWithFourTabsAndNoWebView` — tab-bar smoke + `webViews.count == 0` guard
  - `testEveryRootTabIsReachable` — taps each tab, verifies `isHittable`/`isSelected`
- pt-BR locale forced via launch arguments
- **No search flow UI tests, no alert UI tests**

### 8.4 CI

```yaml
# .github/workflows/ci.yml
runs-on: ubuntu-latest
# Web Playwright tests + TypeScript typecheck + Functions tests
# NO iOS CI — no macOS runner, no xcodebuild test
```

### 8.5 Test plan

- No `.xctestplan` — scheme `Medario.xcscheme` drives both unit + UI tests
- Code coverage enabled
- Both test targets `parallelizable = "NO"`

### 8.6 Urgency/safety/alert tests

**None exist.** "Safe" appears only in retry error message assertions. "Alert" refers only to saved-search notification toggles.

---

## 9. Gap analysis per issue

### #104 — Urgency barrier (first unblocked slice)

| Requirement | Current state |
|-------------|---------------|
| Protocol with explicit version + reviewed signals | Web has version `"2026-07"` with 4 signals — iOS has nothing. Must create native Swift module. |
| Urgent report interrupts search before repository/model/filters | `DirectoryViewModel.load()` goes straight to repository. Barrier must be inserted before `repository.profiles(matching:)`. |
| Alert does not diagnose/prescribe/conclude | Web message: "Este relato pode precisar de atendimento imediato. Procure um serviço de urgência ou ligue 192." — no diagnosis. iOS must replicate. |
| Case/accent/space variations handled deterministically | Web uses simple `includes()` — does NOT handle accent/case. iOS should use `localizedStandardContains` or normalized matching for pt-BR. |
| Non-urgent continues normal flow | Must pass through to existing `load()` path unchanged. |
| Tests prove no interpreter is called when barrier blocks | Need a spy/mock interpreter + test asserting it's never invoked. No interpreter interface exists yet (that's #105). |
| UI test covers alert, confirmation, safe return to search | No UI test for search exists today. Need new XCUITest. |

### #105 — Specialty tracer bullet

| Requirement | Current state |
|-------------|---------------|
| Testable interpretation interface | Does not exist. Must be created (protocol + fake impl). |
| Canonical minimal catalog | Does not exist. Must be built from published profiles. |
| Dynamic guided generation | Foundation Models not integrated. iOS 26+ conditional availability not checked. |
| Domain validation | No validator exists. `PublicProfile.matches(_:)` is the closest, but it's substring-based, not exact-match. |
| Derived filter chip (editable/removable) | No chip UI exists. `DirectoryFiltersView` is a modal sheet only. |
| Generation identity / cancellation | Generation counter exists but no true task cancellation. |

### #106 — Doctor + city + insurance + modality

| Requirement | Current state |
|-------------|---------------|
| Doctor slug support | `PublicProfile.slug` exists; `SavedSearchCriteria` has no slug field — must add. |
| 20-doctor preselection | Does not exist. Must be built. |
| Modality enum bridging | `ConsultationModality` ↔ `SavedSearchModality` mapping does not exist. |
| Empty catalog handling | No catalog exists yet. |
| Intersection (never expand) | Current `matches(_:)` already intersects, but with substring not exact match. |

### #107 — Fallback / unavailability

| Requirement | Current state |
|-------------|---------------|
| Device/Apple Intelligence/model availability checks | None exist. |
| 15-second defensive timeout | None exist. |
| Prewarm after first character | None exist. |
| Generation identity increment on new submission | `generation` counter exists but no cancellation. |
| Out-of-order response rejection | Generation guard exists. |
| UI never reveals model/Foundation Models/error | Current UI has no model references. Must maintain. |
| Repository failure vs local failure separation | Repository `throws` pass-through; VM shows generic Portuguese error. |

### #108 — Derived filters + clarification

| Requirement | Current state |
|-------------|---------------|
| Derived filter chips (accessible, removable) | No chip UI exists. |
| Manual > derived precedence | No derived filter concept exists. |
| Edit derived → promotes to manual | No derived filter concept exists. |
| Clear search removes all | `clearSearch()` exists but only resets `query`/`criteria`. |
| Needs clarification outcome | Not implemented. |
| Unsupported outcome | Not implemented. |
| Only objective criteria persistable | `SavedSearchCriteria.isPersistable` exists. |
| No raw text in UserDefaults/Firestore/URL/logs | Current behavior already excludes free text from `SavedSearchCriteria`. |
| VoiceOver announces states | Not verified for search states. |

### #109 — Automated pt-BR evaluation

| Requirement | Current state |
|-------------|---------------|
| 150+ query corpus | Does not exist. |
| Evaluation harness | Does not exist. |
| Gates (100% urgent block, 100% catalog-valid, 95% direct match) | Not implemented. |
| Corpus privacy (no real data) | Must be synthetic/anonymized. |

### #110 — Physical-device validation

| Requirement | Current state |
|-------------|---------------|
| Release build on physical iPhone | Not yet — TestFlight build `0.1.0 (1)` exists. |
| Instruments Foundation Models measurement | Not possible until #105–#109 complete. |
| Offline validation | Not yet. |
| ADR-0004 → Accepted | Currently "Proposed" — needs all evidence green. |

---

## 10. Dependency chain

```
#104  Urgency barrier (deterministic, model-independent)     ready-for-agent  ← no blockers
  └─ #105  First tracer bullet: specialty interpretation     ready-for-agent
       ├─ #106  Doctor + city + insurance + modality        ready-for-agent
       └─ #107  Fallback / unavailability / cancellation    ready-for-agent
            └─ #108  Derived filters + clarification UX     ready-for-agent  (needs #106 + #107)
                 └─ #109  Automated pt-BR evaluation harness ready-for-agent  (needs #106 + #107 + #108)
                      └─ #110  Physical-device validation    ready-for-human
```

All issues OPEN and unstarted. Only **#104** is unblocked. Every issue mandates skills: `$cavecrew`, `$swiftui-pro:swiftui-pro`, `$caveman-review`.

---

## 11. Key architectural notes

1. **`@Observable` macro** (not `ObservableObject`/`@Published`) — view model state is `private(set)` on `@MainActor` class.
2. **Generation guard is "last writer wins"** — no true `Task` cancellation. Previous tasks run to completion; results discarded by generation check. #107 requires upgrading this to cooperative cancellation.
3. **Two parallel modality enums** (`ConsultationModality` vs `SavedSearchModality`) — not bridged. #106 needs a mapping.
4. **Two parallel saved-items hierarchies** (local `Codable` vs account in-memory) — `AccountSavedSearch` has `alertEnabled` which `LocalSavedSearch` lacks.
5. **`ProfileLocation` authorization gating** is enforced at construction and in computed properties, but NOT in synthesized `Codable` init — decoded locations could carry unauthorized data.
6. **No catalog/enum for specialties, cities, or insurances** — everything is free-text strings. The "Directory Search Catalog" from the PRD must be built from published profiles.
7. **No iOS CI** — all iOS tests run locally only. CI covers web/Functions on ubuntu-latest.
8. **No urgency protocol on iOS** — the web reference has 4 signals and simple `includes()` matching; iOS needs deterministic accent/case/space handling via `localizedStandardContains` or normalization.