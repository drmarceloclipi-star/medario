'use client';

import { FormEvent, useEffect, useState } from 'react';
import type { AccountPort, AccountPreferences, AuthPort, AuthSession } from '@medario/domain';

import { createFirebaseAccountPort } from '@medario/firebase/account';
import { ProfessionalCalendarConnect } from './professional-calendar-connect';
import { ProfessionalScheduling } from './professional-scheduling';

type AccountClient = AuthPort & AccountPort;

export function AccountShell() {
  const [client, setClient] = useState<AccountClient | null>(null);
  const [session, setSession] = useState<AuthSession>({ status: 'loading' });
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [preferences, setPreferences] = useState<AccountPreferences>({ idioma: 'Português', acessibilidade: false });
  const [healthConsent, setHealthConsent] = useState(false);

  useEffect(() => {
    let active = true;
    let unsubscribe: () => void = () => undefined;
    createFirebaseAccountPort()
      .then((nextClient) => {
        if (!active) return;
        setClient(nextClient);
        unsubscribe = nextClient.subscribe((nextSession) => {
          setSession(nextSession);
          if (nextSession.status === 'signed_in') {
            void nextClient.getProfile().then((profile) => {
              setPreferences({ cidade: profile.cidade, convenio: profile.convenio, tipoAtendimento: profile.tipoAtendimento, idioma: profile.idioma || 'Português', acessibilidade: profile.acessibilidade === true });
              setHealthConsent(profile.consentPreferences === true);
            }).catch(() => setMessage('Conta conectada; preferências indisponíveis.'));
          } else {
            setPreferences({ idioma: 'Português', acessibilidade: false });
            setHealthConsent(false);
          }
        });
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

  const savePreferences = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!client) return;
    setBusy(true);
    try {
      await client.updatePreferences(preferences);
      setMessage('Preferências salvas.');
    } catch {
      setMessage('Não foi possível salvar suas preferências.');
    } finally {
      setBusy(false);
    }
  };

  const changeHealthConsent = async (value: boolean) => {
    if (!client) return;
    setBusy(true);
    try {
      await client.setHealthConsent(value);
      setHealthConsent(value);
      setMessage(value ? 'Consentimento registrado.' : 'Consentimento revogado.');
    } catch {
      setMessage('Não foi possível atualizar o consentimento.');
    } finally {
      setBusy(false);
    }
  };

  const deleteAccount = async () => {
    if (!client || !window.confirm('Excluir sua conta e seus dados sincronizados?')) return;
    setBusy(true);
    try {
      await client.deleteAccount();
      setMessage('Conta excluída.');
    } catch {
      setMessage('Não foi possível excluir a conta.');
    } finally {
      setBusy(false);
    }
  };

  if (session.status === 'loading') return <main className="account-page"><p className="section-label">Conta</p><h1>Carregando sua conta</h1></main>;
  if (session.status === 'signed_in') return <main className="account-page"><p className="section-label">Conta</p><h1>Olá, {session.user.displayName || session.user.email || 'paciente'}.</h1><p>Suas preferências e buscas ficam vinculadas à sua conta.</p><ProfessionalCalendarConnect /><ProfessionalScheduling /><section className="account-card"><h2>Preferências</h2><form onSubmit={savePreferences}><label>Cidade<input value={preferences.cidade || ''} onChange={(event) => setPreferences((current) => ({ ...current, cidade: event.target.value || undefined }))} /></label><label>Convênio<input value={preferences.convenio || ''} onChange={(event) => setPreferences((current) => ({ ...current, convenio: event.target.value || undefined }))} /></label><label>Tipo de atendimento<input value={preferences.tipoAtendimento || ''} onChange={(event) => setPreferences((current) => ({ ...current, tipoAtendimento: event.target.value || undefined }))} /></label><label>Idioma<input value={preferences.idioma || 'Português'} onChange={(event) => setPreferences((current) => ({ ...current, idioma: event.target.value || 'Português' }))} /></label><label><input type="checkbox" checked={preferences.acessibilidade === true} onChange={(event) => setPreferences((current) => ({ ...current, acessibilidade: event.target.checked }))} /> Preciso de recursos de acessibilidade</label><button type="submit" disabled={busy}>{busy ? 'Aguarde…' : 'Salvar preferências'}</button></form></section><section className="account-card"><h2>Consentimento</h2><label><input type="checkbox" checked={healthConsent} disabled={busy} onChange={(event) => void changeHealthConsent(event.target.checked)} /> Permitir que sinais de saúde orientem buscas salvas</label><p>Você pode revogar quando quiser.</p></section><div className="account-actions"><button type="button" onClick={() => void client?.signOut()} disabled={busy}>Sair</button><button type="button" onClick={() => void deleteAccount()} disabled={busy}>Excluir conta</button></div>{message && <p role="status">{message}</p>}</main>;

  return <main className="account-page"><p className="section-label">Conta</p><h1>{mode === 'login' ? 'Entrar no Medário' : 'Criar conta de paciente'}</h1><p>Visitantes continuam podendo buscar sem conta.</p><form onSubmit={submit}><label>E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required /></label><button type="submit" disabled={busy || !client}>{busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}</button></form><button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Criar conta' : 'Já tenho conta'}</button>{message && <p role="status">{message}</p>}</main>;
}
