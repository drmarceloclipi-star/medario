import { describe, expect, it } from 'vitest';

import { canExposePublicJourney, canRecordTelemetry, failedLaunchGates, safeErrorReport, type LaunchEvidence } from '../app/launch-gates';

const readyEvidence: LaunchEvidence = {
  discovery_e2e: true,
  authorization_review: true,
  health_consent: true,
  telemetry_consent: true,
  accessibility: true,
  visual_regression: true,
  error_monitoring: true,
  rollback: true,
  safe_degradation: true,
};

describe('launch gates', () => {
  it('blocks public exposure when a required gate lacks evidence', () => {
    const evidence = { ...readyEvidence, rollback: false, error_monitoring: false };

    expect(canExposePublicJourney(evidence)).toBe(false);
    expect(failedLaunchGates(evidence)).toEqual(['error_monitoring', 'rollback']);
  });

  it('allows telemetry only after explicit consent', () => {
    expect(canRecordTelemetry('unknown')).toBe(false);
    expect(canRecordTelemetry('denied')).toBe(false);
    expect(canRecordTelemetry('granted')).toBe(true);
  });

  it('keeps error reports free of user search or health content', () => {
    const report = safeErrorReport('search_timeout', '/');

    expect(report).toEqual({ code: 'search_timeout', route: '/' });
    expect(report).not.toHaveProperty('query');
    expect(report).not.toHaveProperty('symptoms');
    expect(report).not.toHaveProperty('exactLocation');
  });
});
