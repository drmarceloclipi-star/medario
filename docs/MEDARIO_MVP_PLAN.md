# Medário MVP Plan

## Status

This document records the current product, design, SEO, compliance, and implementation plan for the Medário MVP.

## Visual references

- Home reference: `docs/references/home-reference.png`
- Identity reference: `docs/references/identity-reference.png`
- Product context: `PRODUCT.md`
- Design system: `DESIGN.md`

## 1. Product vision

Medário is a Brazilian medical directory and local visibility platform, starting in Joinville/SC and designed for future expansion to Santa Catarina and Brazil.

Core thesis:

**Medário helps patients find doctors with confidence, and helps doctors become findable with ethics, data, and professional digital presence.**

The product has two sides:

1. Patient search, focused on clarity, trust, and fast access to relevant information.
2. Doctor and clinic visibility, focused on local SEO, profile quality, Google Business Profile, analytics, and ethical digital acquisition.

## 2. Brand

- Name: **Medário**
- Domain target: `medario.com.br`
- Brand concept: fusion of medical care and directory infrastructure.
- Tone: trustworthy, modern, ethical, local, professional, intelligent, and warm.
- Positioning: healthcare discovery infrastructure, not a generic marketplace.

Primary public phrase:

**Encontre médicos com confiança.**

Institutional phrase:

**O catálogo médico inteligente para encontrar especialistas e fortalecer a presença digital de médicos.**

## 3. Geographic strategy

### Phase 1: Joinville/SC

- Validate product demand.
- Build the initial physician base.
- Create local authority.
- Sell the first Medário Pro plans.

### Phase 2: Northern Santa Catarina

- Jaraguá do Sul
- Araquari
- São Francisco do Sul
- Itapoá
- Guaramirim
- Garuva
- São Bento do Sul

### Phase 3: Santa Catarina

- Florianópolis
- Blumenau
- Itajaí
- Balneário Camboriú
- Criciúma
- Chapecó

The brand remains **Medário**. Joinville is the first market, not a geographic limit.

## 4. Site map

### Public MVP

- `/`
- `/medicos/joinville`
- `/especialidades/[especialidade]/joinville`
- `/medicos/[slug-do-medico]`
- `/clinicas/[slug-da-clinica]`
- `/sou-medico`
- `/medario-pro`
- `/diagnostico-presenca-digital`
- `/reivindicar-perfil`
- `/atualizar-dados`
- `/privacidade`
- `/termos`
- `/contato`

### Future product surfaces

- `/medicos/[cidade]`
- `/especialidades/[especialidade]/[cidade]`
- `/sc`
- `/cidades/[cidade]`
- `/admin`
- `/painel-medico`

## 5. Page structures

### Home

Goal: explain Medário quickly and make search the main action.

Sections:

1. Header.
2. Hero with central AI-inspired search.
3. Quick search suggestions.
4. How Medário search works.
5. Preview of conversation and doctor results.
6. Local Joinville block.
7. Doctor acquisition block.
8. Medário Pro summary.
9. Ethical notice.
10. Footer.

### Search page

Required elements:

- Indexable title.
- Persistent search bar.
- Filters for specialty, city, neighborhood, insurance, private care, telemedicine, in-person care, RQE, and verified profile.
- Doctor cards.
- Sponsored placements clearly labeled.
- Local FAQ.
- Medical information confirmation notice.
- Link for doctors to update or claim profiles.

### Doctor profile

Required elements:

- Full name.
- Professional photo.
- CRM and state.
- RQE when applicable.
- Specialty.
- Subspecialties or areas of practice with careful ethical language.
- Address.
- Map.
- Phone.
- WhatsApp.
- Website.
- Insurance plans.
- Type of care.
- Mini bio.
- Education.
- Languages.
- Official links.
- Profile update or claim CTA.

Avoid in the MVP:

- Patient reviews.
- Star ratings.
- Best doctor rankings.
- Testimonials.
- Superiority badges.
- Clinical result promises.
- Doctor comparison mechanics.

## 6. Home wireframe

### Header

- Logo Medário.
- Links: Como funciona, Especialidades, Para médicos, Medário Pro, Entrar.
- Primary CTA: Começar.

### Hero

- Badge: `Diretório médico digital de Joinville/SC`.
- H1: `Encontre médicos com confiança.`
- Supporting copy: `Busque por especialidade, convênio, bairro, CRM, RQE e tipo de atendimento.`
- Central search shell:
  - Primary field: `Qual especialista você procura?`
  - Secondary field: `Cidade ou bairro`
  - Submit: `Buscar médicos`
- Secondary CTA: `Sou médico`.
- Trust line: `Perfis médicos com CRM, RQE e informações verificáveis.`

### Suggestions

- Psiquiatra em Joinville.
- Dermatologista que atende Unimed.
- Pediatra no bairro América.
- Ortopedista presencial.
- Clínico geral com agenda rápida.
- Ginecologista teleconsulta.

### Preview

- Simulated user prompt.
- AI-style answer.
- Two mocked doctor cards.
- Badges for CRM, RQE, availability, insurance, and location.

### Supporting sections

- Como funciona.
- Feito em Joinville/SC.
- Também ajudamos médicos a serem encontrados.
- Medário Pro.
- Footer with medical disclaimer.

## 7. Home copy

### Main hero

**Encontre médicos com confiança.**

**O Medário ajuda você a encontrar especialistas em Joinville por especialidade, bairro, convênio, CRM, RQE e tipo de atendimento.**

### Search labels

- Primary field label: `Especialidade ou necessidade`
- Primary field placeholder: `Qual especialista você procura?`
- Location field label: `Localização`
- Location placeholder: `Cidade ou bairro`
- Submit: `Buscar médicos`
- Secondary CTA: `Sou médico`

### Trust message

**Perfis médicos com CRM, RQE e informações verificáveis. Confirme sempre os dados diretamente com o profissional antes do agendamento.**

### How it works

**Busque do seu jeito**  
Digite especialidade, convênio, bairro ou tipo de atendimento.

**Veja informações claras**  
CRM, RQE, localização, contatos e modalidades de atendimento em um só lugar.

**Entre em contato com segurança**  
Acesse WhatsApp, telefone, mapa ou site oficial do profissional.

## 8. Sou médico copy

### H1

**Ajude pacientes a encontrarem seu trabalho com mais clareza.**

### Subheading

**O Medário organiza sua presença profissional para que pacientes encontrem informações corretas, verificáveis e fáceis de acessar.**

### Content blocks

**Reivindique seu perfil**  
Atualize CRM, RQE, especialidades, endereço, contatos, convênios e canais oficiais.

**Fortaleça sua presença local**  
Melhore sua visibilidade em buscas locais com uma página profissional estruturada.

**Acompanhe sinais importantes**  
Veja cliques em WhatsApp, telefone, mapa e perfil, sempre com respeito à privacidade dos pacientes.

### CTAs

- `Reivindicar meu perfil`
- `Receber diagnóstico gratuito`

## 9. Medário Pro copy

### H1

**Presença digital médica com ética, dados e clareza.**

### Subheading

**O Medário Pro ajuda médicos e clínicas a serem encontrados por pacientes certos, com informações estruturadas, SEO local e métricas úteis.**

### Plans

**Perfil Básico**  
Gratuito. Dados essenciais, atualização cadastral e possibilidade de reivindicação.

**Medário Pro Perfil**  
Perfil enriquecido, mais controle de conteúdo e métricas básicas.

**Medário Pro Growth**  
SEO local, Google Business Profile, página profissional, Analytics, Search Console e relatório mensal.

**Medário Pro Ads**  
Landing page, campanhas no Google Ads, acompanhamento de conversões e relatórios. Verba de mídia separada.

### CTAs

- `Conhecer o Medário Pro`
- `Receber diagnóstico gratuito da minha presença digital`

## 10. Doctor card structure

Visible fields:

- Photo or initials.
- Full name.
- Specialty.
- CRM.
- RQE when available.
- Neighborhood and city.
- Care type: in-person, telemedicine, or both.
- Main insurance plans.
- Badges: CRM verified, RQE informed, verified profile, sponsored when applicable.
- Actions: WhatsApp, call, view profile.

Rules:

- The doctor name is the primary hierarchy.
- Badges must not overpower the doctor identity.
- Sponsored status is visible before click.
- No rating, score, rank, or best-doctor language.

## 11. Doctor profile structure

Required fields:

- Full name.
- Professional photo.
- CRM/UF.
- RQE.
- Primary specialty.
- Areas of practice, worded carefully.
- Objective bio.
- Locations.
- Map.
- Phone.
- WhatsApp.
- Website.
- Insurance plans.
- In-person or online care.
- Education.
- Languages.
- Official links.
- Last updated date.
- Trust status: claimed profile, CRM checked, data updated, sponsored when applicable.
- CTAs: WhatsApp, call, map, claim or update profile.

## 12. Initial database model

### doctors

- id
- full_name
- slug
- crm
- crm_state
- rqe
- specialty_id
- bio
- photo_url
- verified_status
- claimed_status
- created_at
- updated_at

### specialties

- id
- name
- slug
- description

### doctor_specialties

- doctor_id
- specialty_id
- is_primary

### locations

- id
- doctor_id
- clinic_name
- address
- neighborhood
- city
- state
- latitude
- longitude

### contacts

- id
- doctor_id
- phone
- whatsapp
- website
- email

### insurances

- id
- name
- slug

### doctor_insurances

- doctor_id
- insurance_id

### profile_claims

- id
- doctor_id
- requester_name
- requester_email
- requester_phone
- status
- created_at

### sponsored_placements

- id
- doctor_id
- placement_type
- city
- specialty_id
- starts_at
- ends_at
- label
- active

### analytics_events

- id
- doctor_id
- event_type
- source_page
- city
- specialty
- created_at

## 13. Local SEO strategy

Initial indexable pages:

- `/medicos/joinville`
- `/especialidades/psiquiatria/joinville`
- `/especialidades/dermatologia/joinville`
- `/especialidades/ginecologia-e-obstetricia/joinville`
- `/especialidades/endocrinologia/joinville`
- `/especialidades/ortopedia/joinville`
- `/especialidades/cardiologia/joinville`
- `/especialidades/pediatria/joinville`
- `/especialidades/oftalmologia/joinville`
- `/especialidades/otorrinolaringologia/joinville`
- `/especialidades/neurologia/joinville`

Each specialty page needs:

- Unique title.
- Meta description.
- Clear H1.
- Useful introductory text.
- Doctor list.
- Filters.
- FAQ.
- Internal links to city, neighborhood, insurance, and profile pages.
- Schema.org markup for `Physician`, `MedicalSpecialty`, `LocalBusiness`, and `BreadcrumbList`.
- Confirmation notice for medical information.

Example title:

**Psiquiatras em Joinville | Medário**

Example description:

**Encontre psiquiatras em Joinville com informações de CRM, RQE, localização, atendimento presencial ou online e canais de contato.**

## 14. Search and ordering criteria

Allowed signals:

1. Specialty or query match.
2. City and neighborhood.
3. Insurance plan.
4. In-person or telemedicine care.
5. CRM informed.
6. RQE informed.
7. Verified profile.
8. Recently updated profile.
9. Profile completeness.
10. Sponsored placement, always labeled.

Rules:

- Sponsored results must not look organic.
- Ranking cannot imply medical quality.
- Avoid superiority terms.
- Explain criteria in a public transparency page.

## 15. Sponsored placement rules

- Every paid placement uses `Patrocinado` or `Destaque patrocinado`.
- The label appears on the card before click.
- Sponsorship does not alter the stated organic search criteria.
- Institutional message: `Destaques patrocinados não alteram os critérios da busca orgânica.`
- Do not sell placement as best-doctor status.
- Reports show aggregate metrics.
- Do not run remarketing based on sensitive specialty or health-condition searches.

## 16. Compliance checklist

- [ ] Do not use `melhores médicos`.
- [ ] Do not use ratings or patient reviews in the MVP.
- [ ] Do not promise clinical outcomes.
- [ ] Do not imply professional superiority.
- [ ] Show CRM clearly.
- [ ] Show RQE when applicable.
- [ ] Identify sponsorship before click.
- [ ] Separate organic and sponsored results visibly.
- [ ] Do not sell sensitive search data.
- [ ] Do not create audiences by condition or sensitive specialty.
- [ ] Use aggregated metrics for doctors.
- [ ] Include a data confirmation notice.
- [ ] Keep language calm, factual, and ethical.

## 17. Visual identity direction

Direction: **Joinville Contemporânea**.

- Navy as the trust anchor.
- Aqua as support for badges, focus states, and local line-art.
- Floral red as a micro-accent only.
- Warm off-white page ground.
- Serif wordmark and hero headline.
- Humanist sans for UI.
- Thin line icons.
- Gentle borders before shadows.
- Local references through abstract flowers, bridge, alameda rhythm, arches, and urban lines.
- Avoid medical crosses, stethoscopes, generic hospital language, and municipality-style identity.

## 18. MVP implementation stages

### Stage 1: Landing and positioning

- Home.
- Sou médico section.
- Medário Pro section.
- Diagnostic CTA.
- Contact capture.

### Stage 2: Initial medical base

- 300 Joinville profiles.
- 10 priority specialties.
- CRM, RQE, contact, neighborhood, and insurance data model.

### Stage 3: Search and SEO pages

- Search page.
- Specialty pages.
- Public doctor profile.
- XML sitemap.
- Schema.org markup.

### Stage 4: Claim and update flow

- Claim form.
- Internal validation flow.
- Claimed and verified profile states.

### Stage 5: Medário Pro

- Plans.
- Free diagnostic.
- Basic metrics.
- Simple monthly report.

### Stage 6: Operations and expansion

- Admin panel.
- Profile audit workflow.
- Northern Santa Catarina expansion.
- Programmatic city pages.

## 19. Current implementation priority

Build a simple, elegant, trustworthy, sellable website, starting with Joinville/SC and prepared for expansion.

Immediate build target:

1. Static responsive home page.
2. Visual language aligned with the reference home mock and identity board.
3. SEO title and description.
4. Clear patient and doctor conversion paths.
5. No dependency on real search or database yet.
