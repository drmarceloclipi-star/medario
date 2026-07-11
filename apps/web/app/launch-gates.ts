export type LaunchGate =
  | 'discovery_e2e'
  | 'authorization_review'
  | 'health_consent'
  | 'telemetry_consent'
  | 'accessibility'
  | 'visual_regression'
  | 'error_monitoring'
  | 'rollback'
  | 'safe_degradation';

export type LaunchEvidence = Readonly<Record<LaunchGate, boolean>>;

export function failedLaunchGates(evidence: LaunchEvidence): LaunchGate[] {
  return (Object.keys(evidence) as LaunchGate[]).filter((gate) => !evidence[gate]);
}

export function canExposePublicJourney(evidence: LaunchEvidence) {
  return failedLaunchGates(evidence).length === 0;
}

export type TelemetryConsent = 'granted' | 'denied' | 'unknown';

export function canRecordTelemetry(consent: TelemetryConsent) {
  return consent === 'granted';
}

export type SafeErrorReport = {
  code: string;
  route: string;
};

export function safeErrorReport(code: string, route: string): SafeErrorReport {
  return { code, route };
}
