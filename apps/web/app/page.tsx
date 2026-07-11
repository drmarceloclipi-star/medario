export default function HomePage() {
  return (
    <main className="app-shell">
      <header className="app-topbar">
        <span className="wordmark">Medário</span>
      </header>

      <section className="welcome" aria-labelledby="welcome-title">
        <p className="eyebrow">Nova aplicação web mobile</p>
        <h1 id="welcome-title">A fundação está pronta.</h1>
        <p>
          Esta rota é isolada do site público atual e servirá de base para o shell mobile,
          busca inteligente e Medário Pro.
        </p>
      </section>
    </main>
  );
}
