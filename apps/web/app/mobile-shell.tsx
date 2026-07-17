'use client';

import { FormEvent, type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { SearchHistoryEntry, SearchSource, SearchSuggestion } from '@medario/domain';
import { Button, Chip, IconButton, Input } from '@medario/ui';

import {
  type DerivedSearch,
  deriveSearch,
  isHistoryEntryCurrent,
  searchUrl,
  shouldPersistSearch,
} from './search';
import { ResultList } from './result-list';
import type { DirectoryDoctor } from './results';
import { type SymptomGuidance, orientSymptomSearch, reviewedUrgencyProtocol } from './symptom-protocol';
import { journeyUrl, readJourneyUrl } from './journey-url';

const historyStorageKey = 'medario.search-history';
const healthConsentStorageKey = 'medario.health-search-consent';
const navItems = [
  { label: 'Início', href: '/' },
  { label: 'Buscar médicos', href: '/#buscar' },
  { label: 'Favoritos', href: '/conta#favoritos' },
  { label: 'Agendamentos', href: '/conta#agendamentos' },
  { label: 'Privacidade e telemetria', href: '/?telemetry=preferences' },
  { label: 'Medário Pro', href: 'https://medario.com.br/medario-pro.html' },
];
const quickPrompts = [
  { label: 'Perto de mim', query: 'Psiquiatra perto de mim' },
  { label: 'Meu convênio', query: 'Médico que atende meu convênio' },
  { label: 'Online hoje', query: 'Consulta online disponível hoje' },
] as const;
const suggestions: SearchSuggestion[] = [
  { id: 'suggestion-psychiatry', label: 'Psiquiatra em Joinville', detail: 'Especialidade · atendimento presencial e online', query: 'Psiquiatra em Joinville' },
  { id: 'suggestion-psychology', label: 'Psicólogo para ansiedade', detail: 'Cuidado emocional · perto de você', query: 'Psicólogo para ansiedade' },
  { id: 'suggestion-pediatrics', label: 'Pediatra que atende Unimed', detail: 'Convênio · consulta infantil', query: 'Pediatra que atende Unimed' },
  { id: 'suggestion-dermatology', label: 'Dermatologista disponível hoje', detail: 'Disponibilidade · atendimento rápido', query: 'Dermatologista disponível hoje' },
];
const filterLabels = {
  specialty: 'Especialidade',
  city: 'Cidade',
  insurance: 'Convênio',
  modality: 'Modalidade',
} as const;
type SearchPhase = 'idle' | 'loading' | 'ready' | 'empty' | 'error';
type PendingSearch = { query: string; source: SearchSource };

function createHistoryEntry(query: string, source: SearchSource): SearchHistoryEntry {
  return {
    id: `${Date.now()}-${query.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}`,
    query,
    source,
    createdAt: new Date().toISOString(),
  };
}

function countFilters(search: DerivedSearch) {
  return Object.values(search.filters).filter(Boolean).length;
}

function initialJourneySearch() {
  if (typeof window === 'undefined') return null;
  const { filters } = readJourneyUrl(window.location.search);
  const search = { filters, hasHealthSignal: false };
  return countFilters(search) > 0 ? search : null;
}

function readableFilter(value: string) {
  if (value === 'telemedicine') return 'Teleconsulta';
  if (value === 'in_person') return 'Presencial';
  return value.replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function storedHealthConsent() {
  return typeof window !== 'undefined' && window.localStorage.getItem(healthConsentStorageKey) === 'granted';
}

function storedHistory(healthConsent: boolean) {
  if (typeof window === 'undefined') return [];
  try {
    const rawHistory = window.localStorage.getItem(historyStorageKey);
    const parsedHistory = rawHistory ? JSON.parse(rawHistory) as SearchHistoryEntry[] : [];
    return parsedHistory.filter((entry) => isHistoryEntryCurrent(entry) && shouldPersistSearch(entry.query, healthConsent));
  } catch {
    return [];
  }
}

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function useDialogFocus(open: boolean, dialogRef: RefObject<HTMLElement | null>, returnFocusRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open || !dialogRef.current) return;
    const dialog = dialogRef.current;
    const previousFocus = returnFocusRef.current ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    dialog.focus();

    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const controls = [...dialog.querySelectorAll<HTMLElement>(focusableSelector)]
        .filter((element) => element.getClientRects().length > 0);
      if (controls.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = controls[0]!;
      const last = controls.at(-1)!;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === dialog) {
        event.preventDefault();
        first.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', trapFocus);
    return () => {
      document.removeEventListener('keydown', trapFocus);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [dialogRef, open, returnFocusRef]);
}

export function MobileShell({ initialDoctors, initialSearch }: { initialDoctors: DirectoryDoctor[]; initialSearch: DerivedSearch | null }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [composerFocused, setComposerFocused] = useState(false);
  const [healthConsent, setHealthConsent] = useState(storedHealthConsent);
  const [history, setHistory] = useState<SearchHistoryEntry[]>(() => storedHistory(storedHealthConsent()));
  const [pendingSearch, setPendingSearch] = useState<PendingSearch | null>(null);
  const [submittedSearch, setSubmittedSearch] = useState<DerivedSearch | null>(() => initialSearch ?? initialJourneySearch());
  const [searchPhase, setSearchPhase] = useState<SearchPhase>(() => initialSearch || initialJourneySearch() ? 'ready' : 'idle');
  const [symptomGuidance, setSymptomGuidance] = useState<SymptomGuidance | null>(null);
  const [urgentGuidance, setUrgentGuidance] = useState<SymptomGuidance | null>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const consentRef = useRef<HTMLElement>(null);
  const dialogReturnFocusRef = useRef<HTMLElement>(null);
  const searchTimerRef = useRef<number | null>(null);
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);
  const modalOpen = drawerOpen || sheetOpen || pendingSearch !== null;

  useDialogFocus(drawerOpen, drawerRef, dialogReturnFocusRef);
  useDialogFocus(sheetOpen, sheetRef, dialogReturnFocusRef);
  useDialogFocus(pendingSearch !== null, consentRef, dialogReturnFocusRef);

  const matchingSuggestions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');
    if (!normalizedQuery) return suggestions.slice(0, 3);
    return suggestions.filter(({ label, detail }) => `${label} ${detail}`.toLocaleLowerCase('pt-BR').includes(normalizedQuery));
  }, [query]);

  useEffect(() => { window.localStorage.setItem(historyStorageKey, JSON.stringify(history)); }, [history]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDrawerOpen(false);
        setSheetOpen(false);
        setPendingSearch(null);
        setComposerFocused(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const overlayOpen = drawerOpen || sheetOpen || pendingSearch !== null;
    document.body.style.overflow = overlayOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen, sheetOpen, pendingSearch]);

  useEffect(() => { if (drawerOpen) drawerRef.current?.focus(); }, [drawerOpen]);
  useEffect(() => { if (sheetOpen) sheetRef.current?.focus(); }, [sheetOpen]);
  useEffect(() => () => { if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current); }, []);

  useEffect(() => {
    const { filters } = readJourneyUrl(window.location.search);
    const canonicalUrl = journeyUrl(filters);
    if (`${window.location.pathname}${window.location.search}` !== canonicalUrl) window.history.replaceState(null, '', canonicalUrl);
  }, []);

  useEffect(() => {
    if (searchPhase === 'ready') resultsHeadingRef.current?.focus();
  }, [searchPhase]);

  const persistHistory = (nextQuery: string, source: SearchSource, canPersistHealthSearch: boolean) => {
    if (!shouldPersistSearch(nextQuery, canPersistHealthSearch)) return;

    const entry = createHistoryEntry(nextQuery, source);
    setHistory((currentHistory) => {
      const nextHistory = [entry, ...currentHistory.filter((item) => item.query.toLocaleLowerCase('pt-BR') !== nextQuery.toLocaleLowerCase('pt-BR'))]
        .filter((item) => isHistoryEntryCurrent(item))
        .slice(0, 5);
      window.localStorage.setItem(historyStorageKey, JSON.stringify(nextHistory));
      return nextHistory;
    });
  };

  const commitSearch = (nextQuery: string, source: SearchSource, canPersistHealthSearch = healthConsent) => {
    const cleanQuery = nextQuery.trim();
    if (!cleanQuery) return;

    try {
      const baseSearch = deriveSearch(cleanQuery);
      const guidance = canPersistHealthSearch ? orientSymptomSearch(cleanQuery) : null;
      const nextSearch = guidance?.kind === 'orientation' ? { ...baseSearch, filters: { ...baseSearch.filters, ...guidance.filters } } : baseSearch;
      setSubmittedSearch(nextSearch);
      setSymptomGuidance(guidance?.kind === 'orientation' ? guidance : null);
      setComposerFocused(false);
      setSearchPhase('loading');
      window.history.replaceState(null, '', searchUrl(nextSearch));
      persistHistory(cleanQuery, source, canPersistHealthSearch);
      if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current);
      searchTimerRef.current = window.setTimeout(() => {
        setSearchPhase(countFilters(nextSearch) > 0 ? 'ready' : 'empty');
      }, 240);
    } catch {
      setSearchPhase('error');
    }
  };

  const requestSearch = (nextQuery: string, source: SearchSource) => {
    const cleanQuery = nextQuery.trim();
    if (!cleanQuery) return;
    const guidance = orientSymptomSearch(cleanQuery);
    if (guidance.kind === 'urgent') {
      setUrgentGuidance(guidance);
      setComposerFocused(false);
      return;
    }
    if (deriveSearch(cleanQuery).hasHealthSignal && !healthConsent) {
      dialogReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setPendingSearch({ query: cleanQuery, source });
      setComposerFocused(false);
      return;
    }
    commitSearch(cleanQuery, source);
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>, source: SearchSource = 'composer') => {
    event.preventDefault();
    requestSearch(query, source);
  };

  const selectQuery = (nextQuery: string, source: SearchSource) => {
    setQuery(nextQuery);
    requestSearch(nextQuery, source);
  };

  const clearHistory = () => {
    window.localStorage.removeItem(historyStorageKey);
    setHistory([]);
  };

  const revokeHealthConsent = () => {
    window.localStorage.removeItem(healthConsentStorageKey);
    setHealthConsent(false);
    setHistory((currentHistory) => {
      const nextHistory = currentHistory.filter((entry) => shouldPersistSearch(entry.query, false));
      window.localStorage.setItem(historyStorageKey, JSON.stringify(nextHistory));
      return nextHistory;
    });
  };

  const removeFilter = (filter: keyof DerivedSearch['filters']) => {
    if (!submittedSearch) return;
    const nextSearch: DerivedSearch = { ...submittedSearch, filters: { ...submittedSearch.filters, [filter]: undefined } };
    setSubmittedSearch(nextSearch);
    window.history.replaceState(null, '', searchUrl(nextSearch));
    setSearchPhase(countFilters(nextSearch) > 0 ? 'ready' : 'empty');
  };

  return (
    <main className="mobile-shell mdr-ui">
      <header className="mobile-topbar" inert={modalOpen} aria-hidden={modalOpen || undefined}>
        <IconButton label="Abrir menu" aria-expanded={drawerOpen} onClick={(event) => { dialogReturnFocusRef.current = event.currentTarget; setDrawerOpen(true); }}>☰</IconButton>
        {submittedSearch ? <Link href="/" aria-label="Medário, página inicial"><Image className="wordmark wordmark-topbar" src="/brand/medario-wordmark.png" alt="Medário" width={1402} height={323} sizes="132px" /></Link> : <span aria-hidden="true" />}
        <Link className="account-entry" href="/conta">Entrar</Link>
      </header>

      <section className="mobile-content" aria-labelledby="home-title" inert={modalOpen} aria-hidden={modalOpen || undefined}>
        <div className="hero-copy">
          {!submittedSearch ? <Image className="wordmark wordmark-home" src="/brand/medario-wordmark-home.png" alt="Medário - Conectando você ao melhor da saúde em Joinville, SC" width={1405} height={421} sizes="(max-width: 768px) 76vw, 368px" priority /> : null}
          <h1 id="home-title">Encontre o médico certo com inteligência e confiança.</h1>
        </div>

        <section className="prompt-section" aria-labelledby="prompt-title">
          <p id="prompt-title" className="section-label">Comece por aqui</p>
          <div className="quick-actions" aria-label="Prompts rápidos">
            {quickPrompts.map((prompt) => <Chip key={prompt.label} onClick={() => selectQuery(prompt.query, 'quick_prompt')}>{prompt.label}</Chip>)}
          </div>
        </section>

        {searchPhase === 'loading' && <section className="search-state" aria-live="polite" aria-busy="true"><span className="state-icon" aria-hidden="true">⋯</span><div><p className="section-label">Preparando busca</p><h2>Organizando seus filtros</h2><p>Verificando especialidade, local, convênio e modalidade.</p></div></section>}
        {searchPhase === 'ready' && submittedSearch && (
          <section className="search-state" aria-live="polite">
            <span className="state-icon" aria-hidden="true">✦</span>
            <div>
              <p className="section-label">Busca interpretada</p>
              <h2 ref={resultsHeadingRef} tabIndex={-1}>Filtros prontos para resultados</h2>
              <p>Orientação de busca, não diagnóstico nem prescrição.</p>
              <div className="derived-filters" aria-label="Filtros editáveis">
                {Object.entries(submittedSearch.filters).filter(([, value]) => value).map(([key, value]) => (
                  <button key={key} type="button" onClick={() => removeFilter(key as keyof DerivedSearch['filters'])} aria-label={`Remover filtro ${filterLabels[key as keyof typeof filterLabels]} ${readableFilter(value!)}`}>
                    {filterLabels[key as keyof typeof filterLabels]}: {readableFilter(value!)} ×
                  </button>
                ))}
              </div>
              {healthConsent && <button className="consent-link" type="button" onClick={revokeHealthConsent}>Revogar consentimento e apagar buscas com sinais de saúde</button>}
            </div>
          </section>
        )}
        {urgentGuidance && <section className="urgent-guidance" role="alert"><p className="section-label">Alerta de urgência</p><h2>Busque atendimento imediato</h2><p>{urgentGuidance.message}</p><small>Protocolo revisado por {reviewedUrgencyProtocol.reviewedBy} · versão {reviewedUrgencyProtocol.version}</small><Button type="button" onClick={() => setUrgentGuidance(null)}>Entendi</Button></section>}
        {searchPhase === 'ready' && symptomGuidance && <section className="symptom-guidance" aria-live="polite"><p className="section-label">Orientação de busca</p><p>{symptomGuidance.message}</p></section>}
        {searchPhase === 'ready' && submittedSearch && <ResultList search={submittedSearch} doctors={initialDoctors} />}
        {searchPhase === 'empty' && <section className="state-card" aria-live="polite"><span className="state-icon" aria-hidden="true">⌕</span><div><strong>Escolha um filtro objetivo.</strong><p>Tente citar especialidade, cidade, convênio ou modalidade para preparar a busca.</p></div></section>}
        {searchPhase === 'error' && <section className="state-card" role="alert"><span className="state-icon" aria-hidden="true">!</span><div><strong>Não foi possível preparar sua busca.</strong><p>Seus dados não foram enviados. Tente novamente.</p><button className="consent-link" type="button" onClick={() => requestSearch(query, 'composer')}>Tentar novamente</button></div></section>}
        {searchPhase === 'idle' && <section className="state-card" aria-label="Estado inicial"><span className="state-icon" aria-hidden="true">✦</span><div><strong>Comece pela sua necessidade.</strong><p>Você pode escrever sintomas, especialidade, convênio ou o tipo de atendimento que procura.</p></div></section>}
      </section>

      <form className="search-composer" onSubmit={submitSearch} inert={modalOpen} aria-hidden={modalOpen || undefined}>
        <IconButton label="Adicionar filtros" className="composer-action" onClick={(event) => { dialogReturnFocusRef.current = event.currentTarget; setSheetOpen(true); }}>＋</IconButton>
        <label className="sr-only" htmlFor="doctor-search">Descreva o que você precisa</label>
        <Input id="doctor-search" value={query} onChange={(event) => setQuery(event.target.value)} onFocus={() => setComposerFocused(true)} placeholder="Descreva o que você precisa" autoComplete="off" />
        <Button className="send-button" type="submit" aria-label="Buscar">↑</Button>
      </form>

      {composerFocused && (
        <section className="search-context" aria-label="Sugestões de busca" inert={modalOpen} aria-hidden={modalOpen || undefined}>
          {matchingSuggestions.length > 0 && <div className="search-context-group"><p className="section-label">Sugestões gerais</p>{matchingSuggestions.map((suggestion) => <button className="suggestion-row" type="button" key={suggestion.id} onMouseDown={(event) => event.preventDefault()} onClick={() => selectQuery(suggestion.query, 'suggestion')}><span aria-hidden="true">⌕</span><div><strong>{suggestion.label}</strong><small>{suggestion.detail}</small></div><b aria-hidden="true">↗</b></button>)}</div>}
          {history.length > 0 && <div className="search-context-group history-group"><div className="context-heading"><p className="section-label">Buscas recentes</p><button type="button" onClick={clearHistory}>Limpar</button></div>{history.slice(0, 3).map((item) => <button className="history-row" type="button" key={item.id} onMouseDown={(event) => event.preventDefault()} onClick={() => selectQuery(item.query, 'history')}><span aria-hidden="true">◷</span>{item.query}</button>)}</div>}
        </section>
      )}

      {pendingSearch && <div className="overlay" role="presentation"><section className="consent-dialog" role="dialog" aria-modal="true" aria-label="Dados de saúde nesta busca" tabIndex={-1} ref={consentRef}><p className="section-label">Consentimento em duas camadas</p><h2>Usar este relato para orientar a busca?</h2><p>Com sua permissão, este termo pode entrar no seu histórico por até 90 dias. Sem permissão, mantemos apenas filtros objetivos e não salvamos o relato.</p><div className="consent-actions"><Button variant="secondary" type="button" onClick={() => { commitSearch(pendingSearch.query, pendingSearch.source, false); setPendingSearch(null); }}>Continuar sem consentimento</Button><Button type="button" onClick={() => { window.localStorage.setItem(healthConsentStorageKey, 'granted'); setHealthConsent(true); commitSearch(pendingSearch.query, pendingSearch.source, true); setPendingSearch(null); }}>Permitir e continuar</Button></div></section></div>}

      {drawerOpen && <div className="overlay" role="presentation" onMouseDown={() => setDrawerOpen(false)}><aside className="side-drawer" role="dialog" aria-modal="true" aria-label="Menu principal" tabIndex={-1} ref={drawerRef} onMouseDown={(event) => event.stopPropagation()}><div className="drawer-header"><Link href="/" aria-label="Medário, página inicial"><Image className="wordmark wordmark-topbar" src="/brand/medario-wordmark.png" alt="Medário" width={1402} height={323} sizes="132px" /></Link><IconButton label="Fechar menu" onClick={() => setDrawerOpen(false)}>×</IconButton></div><nav>{navItems.map((item, index) => <Link className={index === 0 ? 'active' : ''} href={item.href} key={item.label}>{item.label}</Link>)}</nav><div className="drawer-footer"><strong>Encontre o cuidado certo.</strong><span>Joinville · Santa Catarina</span></div></aside></div>}

      {sheetOpen && <div className="overlay sheet-overlay" role="presentation" onMouseDown={() => setSheetOpen(false)}><section className="bottom-sheet" role="dialog" aria-modal="true" aria-label="Filtros da busca" tabIndex={-1} ref={sheetRef} onMouseDown={(event) => event.stopPropagation()}><div className="sheet-handle" aria-hidden="true" /><div className="sheet-heading"><div><span className="sheet-eyebrow">Busca Medário</span><h2>Refinar sua busca</h2></div><IconButton label="Fechar" onClick={() => setSheetOpen(false)}>×</IconButton></div><div className="sheet-options"><button type="button"><span>⌖</span><div><strong>Usar minha localização</strong><small>Solicita autorização antes de calcular proximidade</small></div></button><button type="button"><span>▤</span><div><strong>Filtrar por convênio</strong><small>Mostrar apenas planos aceitos</small></div></button><button type="button"><span>◷</span><div><strong>Disponibilidade</strong><small>Hoje, esta semana ou data específica</small></div></button></div><Button type="button" onClick={() => setSheetOpen(false)}>Continuar</Button></section></div>}
    </main>
  );
}
