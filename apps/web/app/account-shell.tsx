'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import type { AccountPort, AccountPreferences, AuthPort, AuthSession } from '@medario/domain';

import { createFirebaseAccountPort } from '@medario/firebase/account';
import { createFirebaseBrowserClient } from '@medario/firebase';
import { ProfessionalCalendarConnect } from './professional-calendar-connect';
import { ProfessionalScheduling } from './professional-scheduling';
import { deleteAccountAndEndSession, shouldApplyAccountProfile } from './account-security';

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
  const [deleteNeedsReauth, setDeleteNeedsReauth] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const sessionGeneration = useRef(0);

  useEffect(() => {
    let active = true;
    let unsubscribe: () => void = () => undefined;
    createFirebaseAccountPort()
      .then((nextClient) => {
        if (!active) return;
        setClient(nextClient);
        unsubscribe = nextClient.subscribe((nextSession) => {
          const generation = ++sessionGeneration.current;
          setSession(nextSession);
          if (nextSession.status === 'signed_in') {
            void nextClient.getProfile().then((profile) => {
              if (!shouldApplyAccountProfile(active, generation, sessionGeneration.current)) return;
              setPreferences({ cidade: profile.cidade, convenio: profile.convenio, tipoAtendimento: profile.tipoAtendimento, idioma: profile.idioma || 'Português', acessibilidade: profile.acessibilidade === true });
              setHealthConsent(profile.consentPreferences === true);
            }).catch(() => {
              if (shouldApplyAccountProfile(active, generation, sessionGeneration.current)) setMessage('Conta conectada; preferências indisponíveis.');
            });
          } else {
            setPreferences({ idioma: 'Português', acessibilidade: false });
            setHealthConsent(false);
          }
        });
      })
      .catch(() => setMessage('Conta indisponível neste ambiente.'));
    return () => { active = false; sessionGeneration.current += 1; unsubscribe(); };
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { isSignInWithEmailLink, signInWithEmailLink } = await import('firebase/auth');
        const firebase = await createFirebaseBrowserClient();
        if (!isSignInWithEmailLink(firebase.auth, window.location.href)) return;
        const email = window.sessionStorage.getItem('medario.appointment-email');
        if (!email) {
          if (active) setMessage('Abra o link no mesmo navegador em que solicitou o acesso de visitante.');
          return;
        }
        await signInWithEmailLink(firebase.auth, email, window.location.href);
        window.sessionStorage.removeItem('medario.appointment-email');
        const continueTo = new URLSearchParams(window.location.search).get('continue');
        if (continueTo && /^\/perfil\/[a-z0-9-]+(?:\?.*)?$/i.test(continueTo)) window.location.replace(continueTo);
        else if (active) setMessage('E-mail confirmado. Você já pode continuar seu agendamento como visitante.');
      } catch {
        if (active) setMessage('Não foi possível confirmar este link de acesso. Solicite outro pelo perfil médico.');
      }
    })();
    return () => { active = false; };
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

  const deleteAccount = async (password?: string, confirmed = false) => {
    if (!client || (!confirmed && !window.confirm('Excluir sua conta e seus dados sincronizados?'))) return;
    setBusy(true);
    try {
      await deleteAccountAndEndSession((nextPassword) => client.deleteAccount(nextPassword), () => client.signOut(), password);
      setDeleteNeedsReauth(false);
      setDeletePassword('');
      setMessage('Conta excluída.');
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      if (code === 'functions/failed-precondition') {
        setDeleteNeedsReauth(true);
        setMessage('Por segurança, informe sua senha novamente para excluir a conta.');
      } else {
        setMessage(deleteNeedsReauth ? 'Senha incorreta ou sessão inválida.' : 'Não foi possível confirmar todas as etapas. A exclusão pode já ter ocorrido; tente novamente com segurança.');
      }
    } finally {
      setBusy(false);
    }
  };

  if (session.status === 'loading') return <main className="account-page"><p className="section-label">Conta</p><h1>Carregando sua conta</h1></main>;
  if (session.status === 'signed_in') return <main className="account-page"><p className="section-label">Conta</p><h1>Olá, {session.user.displayName || session.user.email || 'paciente'}.</h1><p>Suas preferências e buscas ficam vinculadas à sua conta.</p><ProfessionalCalendarConnect /><ProfessionalScheduling /><section className="account-card"><h2>Preferências</h2><form onSubmit={savePreferences}><label>Cidade<input value={preferences.cidade || ''} onChange={(event) => setPreferences((current) => ({ ...current, cidade: event.target.value || undefined }))} /></label><label>Convênio<input value={preferences.convenio || ''} onChange={(event) => setPreferences((current) => ({ ...current, convenio: event.target.value || undefined }))} /></label><label>Tipo de atendimento<input value={preferences.tipoAtendimento || ''} onChange={(event) => setPreferences((current) => ({ ...current, tipoAtendimento: event.target.value || undefined }))} /></label><label>Idioma<input value={preferences.idioma || 'Português'} onChange={(event) => setPreferences((current) => ({ ...current, idioma: event.target.value || 'Português' }))} /></label><label><input type="checkbox" checked={preferences.acessibilidade === true} onChange={(event) => setPreferences((current) => ({ ...current, acessibilidade: event.target.checked }))} /> Preciso de recursos de acessibilidade</label><button type="submit" disabled={busy}>{busy ? 'Aguarde…' : 'Salvar preferências'}</button></form></section><section className="account-card"><h2>Consentimento</h2><label><input type="checkbox" checked={healthConsent} disabled={busy} onChange={(event) => void changeHealthConsent(event.target.checked)} /> Permitir que sinais de saúde orientem buscas salvas</label><p>Ao revogar, novas buscas sensíveis são bloqueadas e os interesses derivados já salvos são apagados.</p></section>{deleteNeedsReauth && <section className="account-card"><h2>Confirme sua identidade</h2><form onSubmit={(event) => { event.preventDefault(); void deleteAccount(deletePassword, true); }}><label>Senha<input type="password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} required autoComplete="current-password" /></label><button type="submit" disabled={busy || !deletePassword}>{busy ? 'Aguarde…' : 'Confirmar exclusão'}</button></form></section>}<div className="account-actions"><button type="button" onClick={() => void client?.signOut()} disabled={busy}>Sair</button><button type="button" onClick={() => void deleteAccount()} disabled={busy}>Excluir conta</button></div>{message && <p role="status">{message}</p>}</main>;

  return <main className="account-page"><p className="section-label">Conta</p><h1>{mode === 'login' ? 'Entrar no Medário' : 'Criar conta de paciente'}</h1><p>Visitantes continuam podendo buscar sem conta.</p><form onSubmit={submit}><label>E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required /></label><button type="submit" disabled={busy || !client}>{busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}</button></form><button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Criar conta' : 'Já tenho conta'}</button>{message && <p role="status">{message}</p>}</main>;
}
