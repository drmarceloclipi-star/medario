'use client';

import { useMemo, useState } from 'react';
import { Button } from '@medario/ui';

import type { DerivedSearch } from './search';
import { type DirectoryDoctor, type ResultSort, resultPage, searchDirectory } from './results';
import { MapResults } from './map-results';
import { canAddToComparison } from './comparison';
import { ComparisonPanel } from './comparison-panel';

const availabilityCopy = {
  confirmed_slot: 'Vaga confirmada',
  accepts_new_patients: 'Aceita novos pacientes',
  to_confirm: 'Disponibilidade a confirmar',
} as const;

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(value)).replace('.', '');
}

function DoctorResultCard({ doctor, sponsored = false, selected = false, onSelect, comparing = false, onCompare }: { doctor: DirectoryDoctor; sponsored?: boolean; selected?: boolean; onSelect?: () => void; comparing?: boolean; onCompare?: () => void }) {
  const mainLocation = doctor.locations[0];
  return (
    <article className={`result-card ${selected ? 'selected' : ''}`} onClick={onSelect}>
      {sponsored && <p className="sponsor-label">Patrocinado</p>}
      <div className="result-card-heading">
        <div className="doctor-initials" aria-hidden="true">{doctor.name.replace(/^(Dra?\.)\s/, '').split(' ').map((part) => part[0]).slice(0, 2).join('')}</div>
        <div><h2>{doctor.name}</h2><p>{doctor.specialties.map((item) => item.name).join(', ')} · {doctor.crm}</p>{doctor.rqe && <p>{doctor.rqe}</p>}</div>
      </div>
      <dl className="result-facts">
        <div><dt>Atendimento</dt><dd>{doctor.appointmentTypes.map((type) => type === 'telemedicine' ? 'Teleconsulta' : 'Presencial').join(' · ')}</dd></div>
        <div><dt>Local</dt><dd>{mainLocation?.district ? `${mainLocation.district} · ` : ''}{mainLocation?.city}{doctor.distanceKm !== undefined ? ` · ${doctor.distanceKm.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km` : ''}</dd></div>
        <div><dt>Disponibilidade</dt><dd>{availabilityCopy[doctor.availabilityState]}{doctor.availability?.nextAvailableAt ? ` · ${dateLabel(doctor.availability.nextAvailableAt)}` : ''}</dd></div>
        <div><dt>Convênios</dt><dd>{doctor.insuranceDetails.map((insurance) => `${insurance.name} · ${insurance.status === 'confirmed' ? 'Convênio confirmado' : 'Convênio informado: confirme antes'}`).join(' · ')}</dd></div>
      </dl>
      <footer><span>Dado atualizado em {dateLabel(doctor.updatedAt)}</span>{onCompare && <button type="button" onClick={(event) => { event.stopPropagation(); onCompare(); }}>{comparing ? 'Remover comparação' : 'Comparar'}</button>}<a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${mainLocation?.district ?? ''} ${mainLocation?.city ?? ''}`)}`} target="_blank" rel="noreferrer">Rota no Google Maps</a><a href={`/medicos/${doctor.slug}`}>Ver perfil</a></footer>
    </article>
  );
}

export function ResultList({ search }: { search: DerivedSearch }) {
  const [sort, setSort] = useState<ResultSort>('relevance');
  const [cursor, setCursor] = useState(0);
  const [locationStatus, setLocationStatus] = useState<'unknown' | 'loading' | 'available' | 'unavailable'>('unknown');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
  const hasPatientLocation = locationStatus === 'available';
  const results = useMemo(() => searchDirectory(search, sort, hasPatientLocation), [search, sort, hasPatientLocation]);
  const page = resultPage(results.organic, cursor);
  const visibleOrganic = results.organic.slice(0, cursor * 2 + page.items.length);

  const requestLocation = () => {
    if (!navigator.geolocation) { setLocationStatus('unavailable'); return; }
    setLocationStatus('loading');
    navigator.geolocation.getCurrentPosition(
      () => setLocationStatus('available'),
      () => setLocationStatus('unavailable'),
      { enableHighAccuracy: false, maximumAge: 0, timeout: 10000 },
    );
  };

  if (results.organic.length === 0 && results.sponsored.length === 0) {
    return <section className="empty-results" aria-live="polite"><h2>Nenhum médico compatível agora.</h2><p>Tente outra especialidade, cidade, convênio ou modalidade. Não criamos resultados que não existam.</p></section>;
  }

  return (
    <section className="results-section" aria-label="Resultados da busca">
      <div className="results-toolbar">
        <div><p className="section-label">Resultados</p><h2>{results.organic.length} perfis compatíveis</h2></div>
        <label>Ordenar resultados<select aria-label="Ordenar resultados" value={sort} onChange={(event) => { setSort(event.target.value as ResultSort); setCursor(0); }}><option value="relevance">Relevância</option><option value="distance">Distância</option><option value="availability">Disponibilidade</option><option value="updated">Atualização</option></select></label>
      </div>
      <p className="order-explainer"><strong>Ordem orgânica.</strong> Considera filtros exatos, distância quando autorizada, disponibilidade e atualização. Não indica qualidade médica.</p>
      {!hasPatientLocation && <div className="location-prompt"><div><strong>Quer ver distância?</strong><p>Sua localização é usada só nesta busca.</p></div><Button variant="secondary" type="button" loading={locationStatus === 'loading'} onClick={requestLocation}>Usar localização</Button></div>}
      {locationStatus === 'unavailable' && <p className="location-feedback" role="status">Localização não autorizada. Resultados continuam sem quilometragem.</p>}
      <ComparisonPanel doctors={results.organic.filter((doctor) => comparisonIds.includes(doctor.id))} onRemove={(id) => setComparisonIds((current) => current.filter((item) => item !== id))} />
      <MapResults doctors={results.organic} selectedDoctorId={selectedDoctorId} onSelect={setSelectedDoctorId} />
      <div className="organic-results">{visibleOrganic.map((doctor) => <DoctorResultCard doctor={doctor} selected={doctor.id === selectedDoctorId} onSelect={() => setSelectedDoctorId(doctor.id)} comparing={comparisonIds.includes(doctor.id)} onCompare={() => setComparisonIds((current) => current.includes(doctor.id) ? current.filter((item) => item !== doctor.id) : canAddToComparison(current, doctor.id) ? [...current, doctor.id] : current)} key={doctor.id} />)}</div>
      {page.nextCursor !== null && <Button className="load-more" type="button" variant="secondary" onClick={() => setCursor(page.nextCursor!)}>Carregar mais resultados</Button>}
      {results.sponsored.length > 0 && <section className="sponsored-results" aria-labelledby="sponsored-title"><p className="section-label">Posicionamento pago</p><h2 id="sponsored-title">Patrocinados</h2>{results.sponsored.map((doctor) => <DoctorResultCard doctor={doctor} sponsored key={doctor.id} />)}</section>}
    </section>
  );
}
