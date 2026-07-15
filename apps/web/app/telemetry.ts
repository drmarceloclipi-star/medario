'use client';

import { createFirebaseBrowserClient } from '@medario/firebase';

const consentKey = 'medario.telemetry-consent';
export type TelemetryConsent = 'granted' | 'denied' | 'unknown';

export function telemetryConsent(): TelemetryConsent {
  const value = typeof window === 'undefined' ? null : window.localStorage.getItem(consentKey);
  return value === 'granted' || value === 'denied' ? value : 'unknown';
}

export async function setTelemetryConsent(consent: Exclude<TelemetryConsent, 'unknown'>) {
  window.localStorage.setItem(consentKey, consent);
  if (consent !== 'granted') return;
  const client = await createFirebaseBrowserClient();
  const analytics = await import('firebase/analytics');
  if (!(await analytics.isSupported())) return;
  const instance = analytics.getAnalytics(client.app);
  analytics.setAnalyticsCollectionEnabled(instance, true);
  analytics.logEvent(instance, 'telemetry_consent_granted');
}

export async function recordTechnicalEvent(name: 'client_runtime_error' | 'client_unhandled_rejection') {
  if (telemetryConsent() !== 'granted') return;
  const client = await createFirebaseBrowserClient();
  const analytics = await import('firebase/analytics');
  if (!(await analytics.isSupported())) return;
  const instance = analytics.getAnalytics(client.app);
  analytics.logEvent(instance, name);
}
