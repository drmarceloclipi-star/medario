'use client';

import { useMemo, useState } from 'react';
import { useEffect } from 'react';
import type { AuthSession } from '@medario/domain';
import { createSavedItemsCallableClient, type SavedItemsCallableClient } from '@medario/firebase';
import { createFirebaseAccountPort } from '@medario/firebase/account';
import { Button } from '@medario/ui';

import type { DerivedSearch } from './search';
import { journeyUrl } from './journey-url';
import { type DirectoryDoctor, type ResultSort, resultPage, searchDirectory } from './results';
import { MapResults } from './map-results';
import { canAddToComparison } from './comparison';
import { ComparisonPanel } from './comparison-panel';
import { createSavedItemsStore, savedCriteriaKey } from './saved-items';

const availabilityCopy = {
  confirmed_slot: 'Vaga confirmada',
  accepts_new_patients: 'Aceita novos pacientes',
  to_confirm: 'Disponibilidade a confirmar',
} as const;

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(value)).replace('.', '');
}

function DoctorResultCard({ doctor, search, sponsored = false, selected = false, onSelect, comparing = false, onCompare, favorite = false, onFavorite }: { doctor: DirectoryDoctor; search: DerivedSearch; sponsored?: boolean; selected?: boolean; onSelect?: () => void; comparing?: boolean; onCompare?: () => void; favorite?: boolean; onFavorite?: () => void }) {
  const mainLocation = doctor.locations[0];
  return (
    <article className={`result-card ${selected ? 'selected' : ''}`}>
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
      <footer><span>Dado atualizado em {dateLabel(doctor.updatedAt)}</span>{onSelect && <button type="button" aria-pressed={selected} onClick={onSelect}>{selected ? 'Selecionado no mapa' : 'Selecionar no mapa'}</button>}{onFavorite && <button type="button" onClick={onFavorite}>{favorite ? 'Remover favorito' : 'Favoritar'}</button>}{onCompare && <button type="button" onClick={onCompare}>{comparing ? 'Remover comparação' : 'Comparar'}</button>}<a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${mainLocation?.district ?? ''} ${mainLocation?.city ?? ''}`)}`} target="_blank" rel="noreferrer">Rota no Google Maps</a><a href={`/perfil/${doctor.slug}${journeyUrl(search.filters).replace('/', '')}`}>Ver perfil</a></footer>
    </article>
  );
}

export function ResultList({ search, doctors }: { search: DerivedSearch; doctors: DirectoryDoctor[] }) {
  const [sort, setSort] = useState<ResultSort>('relevance');
  const [cursor, setCursor] = useState(0);
  const [locationStatus, setLocationStatus] = useState<'unknown' | 'loading' | 'available' | 'unavailable'>('unknown');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
  const [savedItems] = useState(() => typeof window === 'undefined' ? null : createSavedItemsStore(window.localStorage));
  const [favoriteIds, setFavoriteIds] = useState(() => savedItems?.favorites().map((item) => item.doctorId) ?? []);
  const [savedSearches, setSavedSearches] = useState(() => savedItems?.savedSearches() ?? []);
  const [savedSearchMessage, setSavedSearchMessage] = useState('');
  const [accountSession, setAccountSession] = useState<AuthSession>({ status: 'loading' });
  const [savedClient, setSavedClient] = useState<SavedItemsCallableClient | null>(null);
  const [mergeBusy, setMergeBusy] = useState(false);
  const [mergeMessage, setMergeMessage] = useState('');
  const hasPatientLocation = locationStatus === 'available';
  const results = useMemo(() => searchDirectory(search, sort, hasPatientLocation, doctors), [search, sort, hasPatientLocation, doctors]);
  const page = resultPage(results.organic, cursor);
  const visibleOrganic = results.organic.slice(0, cursor * 2 + page.items.length);

  useEffect(() => {
    let active = true;
    let unsubscribe: () => void = () => undefined;
    void createFirebaseAccountPort()
      .then((account) => {
        if (!active) return;
        unsubscribe = account.subscribe(setAccountSession);
        return createSavedItemsCallableClient();
      })
      .then((client) => { if (active && client) setSavedClient(client); })
      .catch(() => { if (active) setAccountSession({ status: 'signed_out' }); });
    return () => { active = false; unsubscribe(); };
  }, []);

  const mergeVisitorItems = async () => {
    if (!savedClient || accountSession.status !== 'signed_in') return;
    setMergeBusy(true);
    setMergeMessage('');
    const expectedUid = accountSession.user.uid;
    try {
      await Promise.all(favoriteIds.map((doctorId) => savedClient.favoriteDoctor(doctorId, expectedUid)));
      const existing = await savedClient.listSavedItems(expectedUid);
      const knownSearches = new Set(existing.searches.map((search) => savedCriteriaKey(search.criteria)));
      const searchesToSync = savedSearches.filter((search) => {
        const key = savedCriteriaKey(search.criteria);
        if (knownSearches.has(key)) return false;
        knownSearches.add(key);
        return true;
      });
      await Promise.all(searchesToSync.map((search) => savedClient.saveAccountSearch({ criteria: search.criteria, alertEnabled: false, expectedUid })));
      const synced = await savedClient.listSavedItems(expectedUid);
      setFavoriteIds(synced.favorites.map((item) => item.doctorId));
      setMergeMessage(`Favoritos e buscas sincronizados com sua conta (${synced.favorites.length} favorito(s)).`);
    } catch {
      setMergeMessage('Não foi possível sincronizar tudo. Tente novamente.');
    } finally {
      setMergeBusy(false);
    }
  };

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
      <div className="visitor-save"><div><strong>Salvar esta busca</strong><p>Favoritos e buscas ficam neste dispositivo. Criar conta é opcional para futura sincronização.</p></div><Button variant="secondary" type="button" onClick={() => { savedItems?.saveSearch({ criteria: search.filters }); setSavedSearches(savedItems?.savedSearches() ?? []); setSavedSearchMessage('Busca salva neste dispositivo.'); }}>Salvar busca</Button>{savedSearchMessage && <span role="status">{savedSearchMessage}</span>}</div>
      {accountSession.status === 'signed_in' && savedClient && (favoriteIds.length > 0 || savedSearches.length > 0) && <aside className="visitor-save account-sync"><div><strong>Sincronizar com sua conta</strong><p>Visitantes guardam itens neste dispositivo. A sincronização só acontece quando você pedir.</p></div><Button variant="secondary" type="button" loading={mergeBusy} onClick={() => void mergeVisitorItems()}>Sincronizar agora</Button>{mergeMessage && <span role="status">{mergeMessage}</span>}</aside>}
      {savedSearches.length > 0 && <aside className="visitor-save saved-searches" aria-label="Buscas salvas neste dispositivo"><div><strong>Buscas salvas neste dispositivo</strong><p>Guardamos somente filtros objetivos.</p></div>{savedSearches.map((savedSearch) => <div className="saved-search-row" key={savedSearch.id}><span>{Object.values(savedSearch.criteria).filter(Boolean).join(' · ') || 'Filtros da busca'}</span><button type="button" onClick={() => { savedItems?.removeSearch(savedSearch.id); setSavedSearches(savedItems?.savedSearches() ?? []); }}>Remover busca salva</button></div>)}</aside>}
      {!hasPatientLocation && <div className="location-prompt"><div><strong>Quer ver distância?</strong><p>Sua localização é usada só nesta busca.</p></div><Button variant="secondary" type="button" loading={locationStatus === 'loading'} onClick={requestLocation}>Usar localização</Button></div>}
      {locationStatus === 'unavailable' && <p className="location-feedback" role="status">Localização não autorizada. Resultados continuam sem quilometragem.</p>}
      <ComparisonPanel doctors={results.organic.filter((doctor) => comparisonIds.includes(doctor.id))} onRemove={(id) => setComparisonIds((current) => current.filter((item) => item !== id))} />
      <MapResults doctors={results.organic} selectedDoctorId={selectedDoctorId} onSelect={setSelectedDoctorId} />
      <div className="organic-results">{visibleOrganic.map((doctor) => <DoctorResultCard doctor={doctor} search={search} selected={doctor.id === selectedDoctorId} onSelect={() => setSelectedDoctorId(doctor.id)} favorite={favoriteIds.includes(doctor.id)} onFavorite={() => setFavoriteIds((current) => { const next = current.includes(doctor.id) ? current.filter((id) => id !== doctor.id) : [...current, doctor.id]; if (current.includes(doctor.id)) savedItems?.unfavorite(doctor.id); else savedItems?.favorite(doctor.id); return next; })} comparing={comparisonIds.includes(doctor.id)} onCompare={() => setComparisonIds((current) => current.includes(doctor.id) ? current.filter((item) => item !== doctor.id) : canAddToComparison(current, doctor.id) ? [...current, doctor.id] : current)} key={doctor.id} />)}</div>
      {page.nextCursor !== null && <Button className="load-more" type="button" variant="secondary" onClick={() => setCursor(page.nextCursor!)}>Carregar mais resultados</Button>}
      {results.sponsored.length > 0 && <section className="sponsored-results" aria-labelledby="sponsored-title"><p className="section-label">Posicionamento pago</p><h2 id="sponsored-title">Patrocinados</h2>{results.sponsored.map((doctor) => <DoctorResultCard doctor={doctor} search={search} sponsored key={doctor.id} />)}</section>}
    </section>
  );
}
