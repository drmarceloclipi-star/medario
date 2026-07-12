import { describe, it, expect } from 'vitest';
import { orientSymptomSearch, SymptomGuidance, reviewedUrgencyProtocol } from './symptom-protocol';

describe('symptom-protocol', () => {
  it('should have reviewed urgency protocol', () => {
    expect(reviewedUrgencyProtocol).toBeDefined();
    expect(reviewedUrgencyProtocol.version).toBe("2026-07");
    expect(reviewedUrgencyProtocol.reviewedBy).toBe("Responsável clínica do Medário");
    expect(reviewedUrgencyProtocol.signals).toBeDefined();
    expect(reviewedUrgencyProtocol.signals.length).toBeGreaterThan(0);
  });

  it('should detect urgent signals', () => {
    expect(orientSymptomSearch('dor no peito')).kind.toBe('urgent');
    expect(orientSymptomSearch('falta de ar')).kind.toBe('urgent');
    expect(orientSymptomSearch('desmaio')).kind.toBe('urgent');
    expect(orientSymptomSearch('sangramento intenso')).kind.toBe('urgent');
  });

  it('should return urgent message for urgent signals', () => {
    const result = orientSymptomSearch('dor no peito');
    expect(result.kind).toBe('urgent');
    expect(result.message).toContain('atendimento imediato');
    expect(result.message).toContain('192');
  });

  it('should detect mental health signals', () => {
    expect(orientSymptomSearch('ansiedade')).kind.toBe('orientation');
    expect(orientSymptomSearch('depressão')).kind.toBe('orientation');
    expect(orientSymptomSearch('crise')).kind.toBe('orientation');
  });

  it('should detect physical symptoms', () => {
    expect(orientSymptomSearch('febre')).kind.toBe('orientation');
    expect(orientSymptomSearch('tosse')).kind.toBe('orientation');
  });

  it('should handle empty query', () => {
    expect(orientSymptomSearch('')).kind.toBe('none');
  });

  it('should have correct filters for urgent signals', () => {
    const result = orientSymptomSearch('dor no peito');
    expect(result.kind).toBe('urgent');
    expect(result.filters).toEqual({});
  });

  it('should have correct filters for mental health signals', () => {
    const result = orientSymptomSearch('ansiedade');
    expect(result.kind).toBe('orientation');
    expect(result.filters.specialty).toBe('psiquiatria');
  });

  it('should return correct message types', () => {
    const urgentResult = orientSymptomSearch('dor no peito');
    const orientationResult = orientSymptomSearch('ansiedade');
    const noneResult = orientSymptomSearch('');

    expect(urgentResult.kind).toBe('urgent');
    expect(urgentResult.message).toContain('urgência');
    expect(orientationResult.kind).toBe('orientation');
    expect(orientationResult.message).toContain('Psiquiatria');
    expect(noneResult.kind).toBe('none');
    expect(noneResult.message).toBe('');
  });
});

describe('SymptomGuidance type', () => {
  it('should support urgent kind', () => {
    const guidance: SymptomGuidance = {
      kind: 'urgent',
      message: 'Urgente',
      filters: {},
    };
    expect(guidance.kind).toBe('urgent');
    expect(guidance.message).toBe('Urgente');
  });

  it('should support orientation kind', () => {
    const guidance: SymptomGuidance = {
      kind: 'orientation',
      message: 'Orientação',
      filters: { specialty: 'psiquiatria' },
    };
    expect(guidance.kind).toBe('orientation');
    expect(guidance.message).toBe('Orientação');
    expect(guidance.filters.specialty).toBe('psiquiatria');
  });

  it('should support none kind', () => {
    const guidance: SymptomGuidance = {
      kind: 'none',
      message: 'Não é emergência',
      filters: {},
    };
    expect(guidance.kind).toBe('none');
    expect(guidance.message).toBe('Não é emergência');
  });
});