---
name: Medário
description: Joinville Contemporânea. A local medical discovery system built from navy clinical trust, Joinville blue, floral red accents, off-white paper, and soft aqua support. The visual language references Alameda/Rua das Palmeiras, colonial arches, Cidade das Flores, and precise digital healthcare UI without copying official symbols.

colors:
  # Brand anchors
  medario-navy: "#1D3557" # primary brand, headers, app icon ground, trust anchor
  joinville-blue: "#457B9D" # secondary brand, links, active filters, structural lines
  flor-red: "#E63946" # micro-accent, floral mark, critical emphasis only
  paper: "#F1FAEE" # page ground, warm clinical surface
  aqua: "#A8DADC" # soft support, badges, focus halos, empty-state illustration

  # OKLCH equivalents for modern CSS token systems
  medario-navy-oklch: "oklch(32.8% 0.068 257.3)"
  joinville-blue-oklch: "oklch(56.0% 0.078 238.0)"
  flor-red-oklch: "oklch(61.2% 0.208 22.2)"
  paper-oklch: "oklch(97.5% 0.018 137.8)"
  aqua-oklch: "oklch(85.4% 0.052 199.3)"

  # Surfaces
  surface-page: "#F1FAEE"
  surface-raised: "#FFFFFF"
  surface-soft: "#EAF6F5"
  surface-navy: "#1D3557"
  surface-blue: "#457B9D"

  # Text
  text-strong: "#1D3557"
  text-default: "#23384F"
  text-muted: "#5F7184"
  text-faint: "#8A9AAB"
  text-on-dark: "#F1FAEE"

  # Borders and states
  rule-soft: "rgba(29, 53, 87, 0.14)"
  rule-strong: "rgba(29, 53, 87, 0.28)"
  focus-ring: "rgba(168, 218, 220, 0.75)"
  success: "#2F8B57"
  warning: "#B8791F"
  error: "#E63946"

typography:
  wordmark:
    fontFamily: "DM Serif Display, Source Serif 4, Georgia, serif"
    fontSize: "clamp(2.4rem, 7vw, 6rem)"
    fontWeight: 400
    letterSpacing: "-0.035em"
    lineHeight: 0.95
  display:
    fontFamily: "DM Serif Display, Source Serif 4, Georgia, serif"
    fontSize: "clamp(2.8rem, 6vw, 5.2rem)"
    fontWeight: 400
    letterSpacing: "-0.035em"
    lineHeight: 1.02
  headline:
    fontFamily: "Source Serif 4, DM Serif Display, Georgia, serif"
    fontSize: "clamp(2rem, 3.4vw, 3.2rem)"
    fontWeight: 500
    letterSpacing: "-0.025em"
    lineHeight: 1.08
  title:
    fontFamily: "Sora, Manrope, Avenir Next, system-ui, sans-serif"
    fontSize: "1.2rem"
    fontWeight: 650
    letterSpacing: "-0.015em"
    lineHeight: 1.28
  body:
    fontFamily: "Sora, Manrope, Avenir Next, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.65
  small:
    fontFamily: "Sora, Manrope, Avenir Next, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 450
    lineHeight: 1.45
  eyebrow:
    fontFamily: "IBM Plex Mono, SFMono-Regular, Roboto Mono, monospace"
    fontSize: "0.72rem"
    fontWeight: 600
    letterSpacing: "0.16em"
    textTransform: "uppercase"
  mono:
    fontFamily: "IBM Plex Mono, SFMono-Regular, Roboto Mono, monospace"
    fontSize: "0.78rem"
    fontWeight: 500
    letterSpacing: "0.02em"

rounded:
  none: "0"
  xs: "3px"
  sm: "6px"
  md: "10px"
  lg: "14px"
  xl: "20px"
  app: "24%"
  pill: "999px"

spacing:
  "2xs": "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  "2xl": "48px"
  "3xl": "72px"
  "4xl": "112px"

components:
  button-primary:
    backgroundColor: "{colors.medario-navy}"
    textColor: "{colors.text-on-dark}"
    rounded: "{rounded.md}"
    padding: "0 22px"
    minHeight: "48px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.medario-navy}"
    borderColor: "{colors.rule-strong}"
    rounded: "{rounded.md}"
    padding: "0 22px"
    minHeight: "48px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.joinville-blue}"
    rounded: "{rounded.sm}"
    padding: "0 14px"
  input-search:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-strong}"
    borderColor: "{colors.rule-soft}"
    rounded: "{rounded.lg}"
    padding: "16px 18px"
  card-profile:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-default}"
    borderColor: "{colors.rule-soft}"
    rounded: "{rounded.lg}"
    padding: "20px"
  badge-verified:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.medario-navy}"
    borderColor: "{colors.rule-soft}"
    rounded: "{rounded.pill}"
  badge-sponsored:
    backgroundColor: "#FFF6E6"
    textColor: "#75501B"
    borderColor: "rgba(184, 121, 31, 0.28)"
    rounded: "{rounded.pill}"
---

# Design System: Medário

## 1. Creative North Star: Alameda Clínica

Medário should feel like a precise medical directory walking through a recognizable Joinville corridor: calm, organized, local, and trustworthy.

The brand system is built from four abstract references:

1. **Alameda/Rua das Palmeiras** — vertical rhythm, paired columns, corridor perspective, and wayfinding lines.
2. **Museu Nacional de Imigração e Colonização / arquitetura histórica** — arches, window proportions, refined serif gravity, institutional calm.
3. **Cidade das Flores** — the red two-leaf/floral accent above the wordmark or app icon.
4. **Digital medical search** — clean cards, strong search field, visible filters, verified data, and ethical ranking labels.

The system must never copy the city coat of arms, prefeitura branding, official seals, or literal public symbols. The city appears as visual memory, not as municipal branding.

## 2. Logo System

### Primary wordmark

`Medário` in a high-contrast serif, title case, with custom kerning and the acute accent transformed into a small two-leaf/floral mark.

The wordmark should feel editorial and trustworthy, not decorative. The floral accent is the local signature. It must be small enough to avoid cartooniness and clear enough to work as a brand mark.

### App icon

A navy rounded-square tile with a white or paper-colored `M` and the red floral accent above the central valley of the letter.

Rules:

- Use the icon with enough internal breathing room.
- Keep the red floral accent as a micro-signal, not a large illustration.
- Use navy as the default app icon ground.
- Do not use a generic medical cross as the primary mark.
- Do not use a stethoscope, heart, ECG line, snake, shield, or hospital building as logo core.

### Monogram

The `M` can be interpreted as an abstract alameda: two vertical stems and a central corridor. If palms are used, they must be reduced to geometry, not illustrated trees.

## 3. Color System: Joinville Contemporânea

### Primary colors

- **Medário Navy `#1D3557`** — trust, authority, headers, app icon, primary CTA.
- **Joinville Blue `#457B9D`** — secondary navigation, links, active filter states, map/list accents.
- **Flor Red `#E63946`** — floral mark, notification-critical dot, destructive/error state. Use sparingly.
- **Paper `#F1FAEE`** — warm page ground, large background surfaces.
- **Aqua `#A8DADC`** — support color, focus rings, soft badges, empty states, subtle illustrations.

### Color rules

**The Navy Carries Trust Rule.** If only one color can represent Medário, use navy.

**The Red Is A Mark Rule.** Red belongs to the floral/accent system and true error/destructive states. It is not a generic CTA color.

**The Aqua Softens Rule.** Aqua is used to lower anxiety and support medical clarity. It should not become neon, childish, or decorative filler.

**The Paper Ground Rule.** The default public site should sit on warm off-white paper, not sterile white and not cold gray.

**No Pure Black / Pure White Rule.** Use tinted surfaces. Pure black makes the system feel generic and harsh; pure white makes it look like commodity healthcare SaaS.

**Contrast First Rule.** Never place muted blue/gray text over aqua or blue backgrounds unless contrast has been checked.

## 4. Typography

### Recommended pairing

- **Wordmark / Display:** `DM Serif Display` or custom serif based on it.
- **Editorial headlines:** `Source Serif 4`.
- **UI / body:** `Sora` or `Manrope`.
- **Mono labels:** `IBM Plex Mono`.

### Hierarchy

- **Wordmark:** high-contrast serif, title case, tight negative tracking, custom accent mark.
- **Hero display:** serif, large, calm, not italic.
- **Section headline:** serif or strong UI sans depending on context.
- **UI title:** Sora/Manrope, semibold, compact.
- **Body:** Sora/Manrope, relaxed line height, never cramped.
- **Eyebrow:** short uppercase mono labels only.

### Typography rules

**The Wordmark Is Not Body Type Rule.** The serif brand face is for logo, hero, and editorial moments. Product UI uses the sans family.

**Tracked Labels Are Short Rule.** Uppercase tracked labels are allowed for metadata like `VERIFICADO`, `JOINVILLE/SC`, `PATROCINADO`, and `CRM`. Never write full sentences in tracked caps.

**Medical Search Needs Legibility Rule.** Filter labels, doctor names, specialties, addresses, phone actions, and insurance tags must be readable at mobile sizes.

**Name Hierarchy Rule.** Doctor name > specialty > location > verification/scheduling metadata. Do not let badges or decorative accents overpower the physician identity.

## 5. Layout and Geometry

### Spatial language

The layout should use corridor logic: aligned columns, strong vertical rhythm, generous gutters, and clear forward motion from search to result to profile to contact.

### Grid

- Public pages: 12-column grid, max width 1200–1320px.
- Search/results: responsive split between filters and results on desktop; single-column filter drawer on mobile.
- Doctor profile: summary header, trust strip, practice locations, scheduling actions, clinical focus, credentials, and SEO content.

### Shape language

- Rounded corners are moderate, not bubbly.
- App icon uses larger radius; product cards use smaller radius.
- Hairline borders before shadows.
- Use dividers and spacing instead of nesting card inside card.

### Avoid

- Nested cards.
- Generic bento grids for everything.
- Large empty gradient blobs.
- Dense dashboard chrome on patient-facing pages.
- Symmetric hero sections that could belong to any SaaS startup.

## 6. Component Kit

Use reusable primitives before inventing page-specific components.

### Brand primitives

- `.mdr-brand` — mark + wordmark lockup.
- `.mdr-mark` — app icon / monogram tile.
- `.mdr-wordmark` — Medário wordmark.
- `.mdr-flor` — two-leaf/floral accent.

### Page scaffolding

- `.mdr-section` — page-level container.
- `.mdr-section-head` — section title block.
- `.mdr-eyebrow` — short uppercase metadata label.
- `.mdr-rule` — hairline divider.
- `.mdr-alameda-frame` — optional paired vertical line/corridor frame for local identity.

### Search and directory

- `.mdr-search-shell` — main search container.
- `.mdr-search-input` — specialty/name/location search input.
- `.mdr-filter-group` — filter cluster.
- `.mdr-filter-chip` — active/inactive filter pill.
- `.mdr-results-list` — result stack.
- `.mdr-profile-card` — doctor result card.
- `.mdr-profile-avatar` — physician image or initials fallback.
- `.mdr-specialty-tag` — specialty/subspecialty tag.
- `.mdr-trust-strip` — verification, update date, CRM status, sponsored label.

### Doctor profile

- `.mdr-doctor-hero` — top profile block.
- `.mdr-credential-list` — CRM/RQE, formation, titles, clinic affiliations.
- `.mdr-location-card` — clinic/hospital/practice location.
- `.mdr-contact-actions` — call, WhatsApp, website, scheduling link.
- `.mdr-seo-section` — structured editorial content.
- `.mdr-disclaimer` — medical/legal information.

### Doctor dashboard

- `.mdr-dashboard-shell` — authenticated layout.
- `.mdr-metric-card` — views/actions/search appearances.
- `.mdr-completeness-meter` — profile quality.
- `.mdr-recommendation-card` — SEO/Ads/Google Business recommendation.
- `.mdr-task-list` — onboarding checklist.
- `.mdr-insight-row` — analytics insight.

### Feedback and states

- `.mdr-badge.is-verified`
- `.mdr-badge.is-sponsored`
- `.mdr-badge.is-updated`
- `.mdr-badge.is-warning`
- `.mdr-empty-state`
- `.mdr-toast`
- `.mdr-skeleton`
- `.mdr-focus-ring`

## 7. Trust UI

Trust markers must be explicit and boring in the best sense.

### Verification badge

Use navy text on soft aqua/paper surface. Label examples:

- `Perfil verificado`
- `Dados atualizados em maio/2026`
- `CRM conferido`
- `Perfil reivindicado`

### Sponsored label

Sponsored placements must be labeled as `Patrocinado` or `Anúncio`. The label must be visible before user clicks the card. Do not hide sponsorship in hover states, tooltips, or tiny gray footnotes.

### Profile completeness

Use a meter only in the doctor dashboard, not as a public proxy for quality. Public profile completeness can guide ranking, but should not be shown as “quality score”.

## 8. Motion

Motion should reduce friction, not entertain.

Allowed:

- Filter drawer slide.
- Search result loading shimmer.
- Small focus halo.
- Smooth scroll to profile sections.
- Subtle hover lift on clickable cards.

Avoid:

- Bounce/elastic easing.
- Floating medical icons.
- Decorative particles.
- Pulsing red alerts unless truly destructive or urgent.
- Overanimated map markers.

Respect `prefers-reduced-motion`.

## 9. Imagery and Illustration

### Use

- Abstract linework inspired by Joinville street rhythm, palms, arches, flowers, and maps.
- Real clinic/profile images when authorized.
- Calm editorial photography if needed.
- Minimal iconography with consistent stroke weight.

### Avoid

- Stock doctors with crossed arms.
- Generic hospital corridors.
- Cartoon doctors.
- AI-generated fake portraits.
- Literal Prefeitura/brasão/official public symbolism.
- Red cross as brand identity.

## 10. Page Rules

### Homepage

Should quickly say what Medário does, where it operates, and why it is trustworthy. The search field should appear early. Local identity should be visible but restrained.

### Search results

Prioritize task completion. Filters must be clear, mobile-first, and reversible. Each result card should answer: who, specialty, where, how to contact, what is verified, and whether placement is sponsored.

### Doctor profile

The page should feel like a professional dossier, not a social-media bio. Credentials, locations, scheduling, clinical focus, and verification should be structured.

### Doctor acquisition page

Speak to doctors as professionals. Emphasize being found, profile quality, local SEO, Google Business, Ads, Analytics, and ethical visibility. Do not sell “more patients fast” as a crude promise.

### Dashboard

Use product clarity. Metrics must be tied to actions: complete profile, improve specialty page content, add location, verify CRM/RQE, fix Google Business, review Ads performance.

## 11. Do and Do Not

### Do

- Do use the Medário navy as the dominant trust anchor.
- Do keep the floral red accent small and memorable.
- Do make Joinville visible through abstraction, not copying.
- Do use serif for brand/editorial moments and sans for product work.
- Do make verification and sponsorship obvious.
- Do build reusable components.
- Do use hairlines and spacing before shadows.
- Do design mobile-first for real patient search.

### Do Not

- Do not use stethoscope, heart, ECG, snake, shield, or giant medical cross as the main identity.
- Do not imitate the city coat of arms, prefeitura identity, or official seals.
- Do not use purple gradients, glassmorphism, neon cyan, or AI-tool glow.
- Do not use nested cards as the default layout answer.
- Do not use red as a generic CTA.
- Do not use “best doctor” language without methodology.
- Do not let badges overpower doctor names.
- Do not invent page-specific design systems.
- Do not use gray-on-blue or muted text with weak contrast.

## 12. Agent Instructions

Before generating UI, read `PRODUCT.md` and this file.

When creating a page or component:

1. Identify whether the surface is brand mode or product mode.
2. Use the token system first.
3. Use an existing primitive before creating a new component.
4. Preserve search clarity, trust labels, and medical ethics.
5. Remove generic AI design tells before finalizing.
6. Run an accessibility pass before shipping.
7. If a new pattern appears more than once, promote it into the component kit.
