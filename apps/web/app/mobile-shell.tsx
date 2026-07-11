'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';

const navItems = ['Início', 'Buscar médicos', 'Favoritos', 'Agendamentos', 'Medário Pro'];

export function MobileShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [query, setQuery] = useState('');
  const drawerRef = useRef<HTMLElement>(null);
  const sheetRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDrawerOpen(false);
        setSheetOpen(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const overlayOpen = drawerOpen || sheetOpen;
    document.body.style.overflow = overlayOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen, sheetOpen]);

  useEffect(() => {
    if (drawerOpen) drawerRef.current?.focus();
  }, [drawerOpen]);

  useEffect(() => {
    if (sheetOpen) sheetRef.current?.focus();
  }, [sheetOpen]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (query.trim()) setSheetOpen(true);
  };

  return (
    <main className="mobile-shell">
      <header className="mobile-topbar">
        <button
          className="icon-button"
          type="button"
          aria-label="Abrir menu"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
        >
          <span aria-hidden="true">☰</span>
        </button>
        <span className="mobile-wordmark">Medário</span>
        <button className="avatar-button" type="button" aria-label="Abrir conta">
          MC
        </button>
      </header>

      <section className="mobile-content" aria-labelledby="home-title">
        <div className="hero-copy">
          <p className="hero-kicker">Busca médica inteligente</p>
          <h1 id="home-title">Como podemos ajudar você hoje?</h1>
          <p>Descreva sintomas, especialidade, convênio ou o tipo de atendimento que procura.</p>
        </div>

        <div className="quick-actions" aria-label="Atalhos">
          <button type="button" onClick={() => setQuery('Psiquiatra perto de mim')}>Perto de mim</button>
          <button type="button" onClick={() => setQuery('Médico que atende meu convênio')}>Meu convênio</button>
          <button type="button" onClick={() => setQuery('Consulta online disponível hoje')}>Online hoje</button>
        </div>

        <section className="state-card" aria-label="Estado inicial">
          <span className="state-icon" aria-hidden="true">✦</span>
          <div>
            <strong>Comece pela sua necessidade.</strong>
            <p>O Medário organizará especialidade, localização, disponibilidade e perfil profissional.</p>
          </div>
        </section>
      </section>

      <form className="search-composer" onSubmit={submitSearch}>
        <button className="composer-action" type="button" aria-label="Adicionar filtros" onClick={() => setSheetOpen(true)}>＋</button>
        <label className="sr-only" htmlFor="doctor-search">Descreva o que você precisa</label>
        <textarea
          id="doctor-search"
          rows={1}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Descreva o que você precisa"
        />
        <button className="send-button" type="submit" aria-label="Buscar">↑</button>
      </form>

      {drawerOpen && (
        <div className="overlay" role="presentation" onMouseDown={() => setDrawerOpen(false)}>
          <aside
            className="side-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Menu principal"
            tabIndex={-1}
            ref={drawerRef}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="drawer-header">
              <span className="mobile-wordmark">Medário</span>
              <button className="icon-button" type="button" aria-label="Fechar menu" onClick={() => setDrawerOpen(false)}>×</button>
            </div>
            <nav>
              {navItems.map((item, index) => (
                <a className={index === 0 ? 'active' : ''} href="#" key={item}>{item}</a>
              ))}
            </nav>
            <div className="drawer-footer">
              <strong>Encontre o cuidado certo.</strong>
              <span>Joinville · Santa Catarina</span>
            </div>
          </aside>
        </div>
      )}

      {sheetOpen && (
        <div className="overlay sheet-overlay" role="presentation" onMouseDown={() => setSheetOpen(false)}>
          <section
            className="bottom-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Opções da busca"
            tabIndex={-1}
            ref={sheetRef}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="sheet-handle" aria-hidden="true" />
            <div className="sheet-heading">
              <div>
                <span className="sheet-eyebrow">Busca Medário</span>
                <h2>{query.trim() ? 'Preparar resultados' : 'Refinar sua busca'}</h2>
              </div>
              <button className="icon-button" type="button" aria-label="Fechar" onClick={() => setSheetOpen(false)}>×</button>
            </div>
            <div className="sheet-options">
              <button type="button"><span>⌖</span><div><strong>Usar minha localização</strong><small>Encontrar médicos próximos</small></div></button>
              <button type="button"><span>▤</span><div><strong>Filtrar por convênio</strong><small>Mostrar apenas planos aceitos</small></div></button>
              <button type="button"><span>◷</span><div><strong>Disponibilidade</strong><small>Hoje, esta semana ou data específica</small></div></button>
            </div>
            <button className="primary-action" type="button" onClick={() => setSheetOpen(false)}>Continuar</button>
          </section>
        </div>
      )}
    </main>
  );
}
