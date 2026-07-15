'use client';

import { useEffect, useState } from 'react';
import { recordTechnicalEvent, telemetryConsent, setTelemetryConsent } from './telemetry';

export function TelemetryConsent() {
  const [visible, setVisible] = useState(() => telemetryConsent() === 'unknown');
  useEffect(() => {
    if (telemetryConsent() !== 'granted') return;
    const runtimeError = () => { void recordTechnicalEvent('client_runtime_error'); };
    const rejected = () => { void recordTechnicalEvent('client_unhandled_rejection'); };
    window.addEventListener('error', runtimeError);
    window.addEventListener('unhandledrejection', rejected);
    return () => {
      window.removeEventListener('error', runtimeError);
      window.removeEventListener('unhandledrejection', rejected);
    };
  }, [visible]);
  if (!visible) return null;
  const choose = (value: 'granted' | 'denied') => {
    void setTelemetryConsent(value);
    setVisible(false);
  };
  return <section className="consent-dialog" role="dialog" aria-modal="false" aria-label="Consentimento de telemetria"><p className="section-label">Telemetria opcional</p><h2>Ajude a melhorar o Medário</h2><p>Com sua permissão, usamos métricas agregadas de uso e falhas técnicas. Nunca enviamos texto de busca, sintomas, identidade ou localização exata.</p><div className="consent-actions"><button className="mdr-button" type="button" onClick={() => choose('granted')}>Permitir telemetria</button><button className="mdr-button secondary" type="button" onClick={() => choose('denied')}>Continuar sem telemetria</button></div></section>;
}
