'use client';

import { useMemo, useState } from 'react';

import { type ComparisonCriterion, buildComparison, comparisonCriteria } from './comparison';
import type { DirectoryDoctor } from './results';

const labels: Record<ComparisonCriterion, string> = { insurance: 'Convênio', availability: 'Disponibilidade', modality: 'Modalidade', updated: 'Atualização', distance: 'Distância' };

export function ComparisonPanel({ doctors, onRemove }: { doctors: DirectoryDoctor[]; onRemove: (id: string) => void }) {
  const [criteria, setCriteria] = useState<ComparisonCriterion[]>([]);
  const comparison = useMemo(() => buildComparison(doctors.map((doctor) => ({ id: doctor.id, insurances: doctor.insurances, availability: doctor.availabilityState, modalities: doctor.appointmentTypes, updatedAt: doctor.updatedAt, distanceKm: doctor.distanceKm })), criteria), [doctors, criteria]);
  if (doctors.length === 0) return null;
  return <section className="comparison-panel" aria-label="Comparação de médicos"><div><p className="section-label">Comparação</p><h2>{doctors.length} de 3 médicos</h2><p>Escolha o que importa. Não usamos pesos ocultos nem qualidade médica.</p></div><fieldset><legend>Critérios de comparação</legend>{comparisonCriteria.map((criterion) => <label key={criterion}><input type="checkbox" checked={criteria.includes(criterion)} onChange={() => setCriteria((current) => current.includes(criterion) ? current.filter((item) => item !== criterion) : [...current, criterion])} />{labels[criterion]}</label>)}</fieldset><div className="comparison-grid">{doctors.map((doctor) => { const item = comparison.find((row) => row.id === doctor.id); return <article key={doctor.id}><h3>{doctor.name}</h3><p>{doctor.insuranceDetails.map((insurance) => `${insurance.name}: ${insurance.status === 'confirmed' ? 'confirmado' : 'informado'}`).join(' · ') || 'Convênio não informado'}</p><p>{doctor.availabilityState === 'to_confirm' ? 'Disponibilidade a confirmar' : doctor.availabilityState === 'confirmed_slot' ? 'Vaga confirmada' : 'Aceita novos pacientes'}</p><p>{doctor.distanceKm === undefined ? 'Distância indisponível sem localização autorizada' : `${doctor.distanceKm.toLocaleString('pt-BR')} km`}</p><p>{item?.explanation}</p><button type="button" onClick={() => onRemove(doctor.id)}>Remover</button></article>; })}</div></section>;
}
