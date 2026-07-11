'use client';

import { FormEvent, useEffect, useState } from 'react';
import type { AccountPort, AuthPort, AuthSession } from '@medario/domain';

import { createFirebaseAccountPort } from '@medario/firebase/account';

type AccountClient = AuthPort & AccountPort;

export function AccountShell() {
  const [client, setClient] = useState<AccountClient | null>(null);
  const [session, setSession] = useState<AuthSession>({ status: 'loading' });
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    let unsubscribe: () => void = () => undefined;
    createFirebaseAccountPort()
      .then((nextClient) => {
        if (!active) return;
        setClient(nextClient);
        unsubscribe = nextClient.subscribe(setSession);
      })
      .catch(() => setMessage('Conta indisponível neste ambiente.'));
    return () => { active = false; unsubscribe(); };
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!client) return;
    setBusy(true);
    setMessage('');
    try {
      if (mode === 'register') await client.createPatientAccount({ email, password });
      else await client.signInWithEmail(email, password);
      setMessage(mode === 'register' ? 'Conta criada.' : 'Login realizado.');
    } catch {
      setMessage('Não foi possível concluir. Verifique os dados e tente novamente.');
    } finally {
      setBusy(false);
    }
  };

  if (session.status === 'loading') return <main className="account-page"><p className="section-label">Conta</p><h1>Carregando sua conta</h1></main>;
  if (session.status === 'signed_in') return <main className="account-page"><p className="section-label">Conta</p><h1>Olá, {session.user.displayName || session.user.email || 'paciente'}.</h1><p>Suas preferências e buscas ficam vinculadas à sua conta.</p><button type="button" onClick={() => client?.signOut()}>Sair</button>{message && <p role="status">{message}</p>}</main>;

  return <main className="account-page"><p className="section-label">Conta</p><h1>{mode === 'login' ? 'Entrar no Medário' : 'Criar conta de paciente'}</h1><p>Visitantes continuam podendo buscar sem conta.</p><form onSubmit={submit}><label>E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required /></label><button type="submit" disabled={busy || !client}>{busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}</button></form><button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Criar conta' : 'Já tenho conta'}</button>{message && <p role="status">{message}</p>}</main>;
}
