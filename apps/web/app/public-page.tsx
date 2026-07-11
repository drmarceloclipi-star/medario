import Link from 'next/link';
import type { ReactNode } from 'react';

type PublicPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  updatedAt?: string;
};

const navItems = [
  { label: 'Início', href: '/' },
  { label: 'Buscar médicos', href: '/#buscar' },
  { label: 'Para médicos', href: '/sou-medico' },
  { label: 'Medário Pro', href: '/medario-pro' },
];

export function PublicPage({ eyebrow, title, description, children, updatedAt }: PublicPageProps) {
  return (
    <main className="public-page">
      <header className="public-header">
        <Link className="public-brand" href="/" aria-label="Medário, página inicial">Medário</Link>
        <nav aria-label="Navegação institucional" className="public-nav">
          {navItems.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}
          <Link className="public-account-link" href="/conta">Minha conta</Link>
        </nav>
      </header>

      <article className="public-article">
        <header className="public-article-header">
          <p className="section-label">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
          {updatedAt && <small>Última atualização: {updatedAt}</small>}
        </header>
        {children}
      </article>

      <footer className="public-footer">
        <p>Busca médica clara, local e verificável. Feito em Joinville, SC.</p>
        <nav aria-label="Links legais">
          <Link href="/institucional">Institucional</Link>
          <Link href="/termos">Termos</Link>
          <Link href="/privacidade">Privacidade</Link>
        </nav>
      </footer>
    </main>
  );
}

export function PublicSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="public-section"><h2>{title}</h2>{children}</section>;
}

export function PublicNotice({ children }: { children: ReactNode }) {
  return <aside className="public-notice" aria-label="Aviso">{children}</aside>;
}
