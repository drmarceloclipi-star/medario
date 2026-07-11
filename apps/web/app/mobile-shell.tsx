'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { SearchHistoryEntry, SearchSource, SearchSuggestion } from '@medario/domain';
import { Button, Chip, IconButton, Input } from '@medario/ui';

const historyStorageKey = 'medario.search-history';
const navItems = ['Início', 'Buscar médicos', 'Favoritos', 'Agendamentos', 'Medário Pro'];
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

function createHistoryEntry(query: string, source: SearchSource): SearchHistoryEntry {
  return {
    id: `${Date.now()}-${query.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}`,
    query,
    source,
    createdAt: new Date().toISOString(),
  };
}

export function MobileShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [composerFocused, setComposerFocused] = useState(false);
  const [history, setHistory] = useState<SearchHistoryEntry[]>(() => {
    if (typeof window === 'undefined') return [];

    try {
      const storedHistory = window.localStorage.getItem(historyStorageKey);
      return storedHistory ? JSON.parse(storedHistory) as SearchHistoryEntry[] : [];
    } catch {
      window.localStorage.removeItem(historyStorageKey);
      return [];
    }
  });
  const [submittedQuery, setSubmittedQuery] = useState('');
  const drawerRef = useRef<HTMLElement>(null);
  const sheetRef = useRef<HTMLElement>(null);

  const matchingSuggestions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');
    if (!normalizedQuery) return suggestions.slice(0, 3);
    return suggestions.filter(({ label, detail }) => `${label} ${detail}`.toLocaleLowerCase('pt-BR').includes(normalizedQuery));
  }, [query]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDrawerOpen(false);
        setSheetOpen(false);
        setComposerFocused(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const overlayOpen = drawerOpen || sheetOpen;
    document.body.style.overflow = overlayOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen, sheetOpen]);

  useEffect(() => { if (drawerOpen) drawerRef.current?.focus(); }, [drawerOpen]);
  useEffect(() => { if (sheetOpen) sheetRef.current?.focus(); }, [sheetOpen]);

  const saveSearch = (nextQuery: string, source: SearchSource) => {
    const cleanQuery = nextQuery.trim();
    if (!cleanQuery) return;

    const entry = createHistoryEntry(cleanQuery, source);
    setSubmittedQuery(cleanQuery);
    setComposerFocused(false);
    setHistory((currentHistory) => {
      const nextHistory = [entry, ...currentHistory.filter((item) => item.query.toLocaleLowerCase('pt-BR') !== cleanQuery.toLocaleLowerCase('pt-BR'))].slice(0, 5);
      window.localStorage.setItem(historyStorageKey, JSON.stringify(nextHistory));
      return nextHistory;
    });
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>, source: SearchSource = 'composer') => {
    event.preventDefault();
    saveSearch(query, source);
  };

  const selectQuery = (nextQuery: string, source: SearchSource) => {
    setQuery(nextQuery);
    saveSearch(nextQuery, source);
  };

  const clearHistory = () => {
    window.localStorage.removeItem(historyStorageKey);
    setHistory([]);
  };

  return (
    <main className="mobile-shell mdr-ui">
      <header className="mobile-topbar">
        <IconButton label="Abrir menu" aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)}>☰</IconButton>
        {submittedQuery ? <img className="wordmark wordmark-topbar" src="/brand/medario-wordmark.png" alt="Medário" /> : <span aria-hidden="true" />}
        <button className="avatar-button" type="button" aria-label="Abrir conta">MC</button>
      </header>

      <section className="mobile-content" aria-labelledby="home-title">
        <div className="hero-copy">
          {!submittedQuery ? <img className="wordmark wordmark-home" src="/brand/medario-wordmark-home.png" alt="Medário - Conectando você ao melhor da saúde em Joinville, SC" /> : null}
          <h1 id="home-title">Encontre o médico certo com inteligência e confiança.</h1>
        </div>

        <section className="prompt-section" aria-labelledby="prompt-title">
          <p id="prompt-title" className="section-label">Comece por aqui</p>
          <div className="quick-actions" aria-label="Prompts rápidos">
            {quickPrompts.map((prompt) => <Chip key={prompt.label} onClick={() => selectQuery(prompt.query, 'quick_prompt')}>{prompt.label}</Chip>)}
          </div>
        </section>

        {submittedQuery ? (
          <section className="search-state" aria-live="polite">
            <span className="state-icon" aria-hidden="true">✦</span>
            <div>
              <p className="section-label">Busca preparada</p>
              <h2>{submittedQuery}</h2>
              <p>Vamos organizar especialidade, localização, convênio e disponibilidade nos próximos resultados.</p>
            </div>
          </section>
        ) : (
          <section className="state-card" aria-label="Estado inicial">
            <span className="state-icon" aria-hidden="true">✦</span>
            <div>
              <strong>Comece pela sua necessidade.</strong>
              <p>Você pode escrever sintomas, especialidade, convênio ou o tipo de atendimento que procura.</p>
            </div>
          </section>
        )}
      </section>

      <form className="search-composer" onSubmit={submitSearch}>
        <IconButton label="Adicionar filtros" className="composer-action" onClick={() => setSheetOpen(true)}>＋</IconButton>
        <label className="sr-only" htmlFor="doctor-search">Descreva o que você precisa</label>
        <Input id="doctor-search" value={query} onChange={(event) => setQuery(event.target.value)} onFocus={() => setComposerFocused(true)} placeholder="Descreva o que você precisa" autoComplete="off" />
        <Button className="send-button" type="submit" aria-label="Buscar">↑</Button>
      </form>

      {composerFocused && (
        <section className="search-context" aria-label="Sugestões de busca">
          {matchingSuggestions.length > 0 && (
            <div className="search-context-group">
              <p className="section-label">Sugestões</p>
              {matchingSuggestions.map((suggestion) => (
                <button className="suggestion-row" type="button" key={suggestion.id} onMouseDown={(event) => event.preventDefault()} onClick={() => selectQuery(suggestion.query, 'suggestion')}>
                  <span aria-hidden="true">⌕</span><div><strong>{suggestion.label}</strong><small>{suggestion.detail}</small></div><b aria-hidden="true">↗</b>
                </button>
              ))}
            </div>
          )}
          {history.length > 0 && (
            <div className="search-context-group history-group">
              <div className="context-heading"><p className="section-label">Buscas recentes</p><button type="button" onClick={clearHistory}>Limpar</button></div>
              {history.slice(0, 3).map((item) => <button className="history-row" type="button" key={item.id} onMouseDown={(event) => event.preventDefault()} onClick={() => selectQuery(item.query, 'history')}><span aria-hidden="true">◷</span>{item.query}</button>)}
            </div>
          )}
        </section>
      )}

      {drawerOpen && (
        <div className="overlay" role="presentation" onMouseDown={() => setDrawerOpen(false)}>
          <aside className="side-drawer" role="dialog" aria-modal="true" aria-label="Menu principal" tabIndex={-1} ref={drawerRef} onMouseDown={(event) => event.stopPropagation()}>
            <div className="drawer-header"><img className="wordmark wordmark-topbar" src="/brand/medario-wordmark.png" alt="Medário" /><IconButton label="Fechar menu" onClick={() => setDrawerOpen(false)}>×</IconButton></div>
            <nav>{navItems.map((item, index) => <a className={index === 0 ? 'active' : ''} href="#" key={item}>{item}</a>)}</nav>
            <div className="drawer-footer"><strong>Encontre o cuidado certo.</strong><span>Joinville · Santa Catarina</span></div>
          </aside>
        </div>
      )}

      {sheetOpen && (
        <div className="overlay sheet-overlay" role="presentation" onMouseDown={() => setSheetOpen(false)}>
          <section className="bottom-sheet" role="dialog" aria-modal="true" aria-label="Filtros da busca" tabIndex={-1} ref={sheetRef} onMouseDown={(event) => event.stopPropagation()}>
            <div className="sheet-handle" aria-hidden="true" />
            <div className="sheet-heading"><div><span className="sheet-eyebrow">Busca Medário</span><h2>Refinar sua busca</h2></div><IconButton label="Fechar" onClick={() => setSheetOpen(false)}>×</IconButton></div>
            <div className="sheet-options"><button type="button"><span>⌖</span><div><strong>Usar minha localização</strong><small>Encontrar médicos próximos</small></div></button><button type="button"><span>▤</span><div><strong>Filtrar por convênio</strong><small>Mostrar apenas planos aceitos</small></div></button><button type="button"><span>◷</span><div><strong>Disponibilidade</strong><small>Hoje, esta semana ou data específica</small></div></button></div>
            <Button type="button" onClick={() => setSheetOpen(false)}>Continuar</Button>
          </section>
        </div>
      )}
    </main>
  );
}
