'use client';

import { useMemo, useState } from 'react';

import type { DirectoryDoctor } from './results';
import { clusterMapLocations } from './map-query';

export function MapResults({ doctors, selectedDoctorId, onSelect }: { doctors: DirectoryDoctor[]; selectedDoctorId: string | null; onSelect: (id: string) => void }) {
  const [moved, setMoved] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const clusters = useMemo(() => clusterMapLocations(doctors.map((doctor) => ({ doctorId: doctor.id, label: doctor.name, city: doctor.locations[0]?.city ?? '', authorized: doctor.mapLocation.authorized, latitude: doctor.mapLocation.latitude, longitude: doctor.mapLocation.longitude }))), [doctors]);
  if (unavailable) return <section className="map-fallback" role="status"><strong>Mapa indisponível.</strong><p>Use a lista e os filtros para continuar sua busca.</p><button type="button" onClick={() => setUnavailable(false)}>Tentar mapa novamente</button></section>;
  return <section className="map-results" aria-label="Mapa dos locais de atendimento"><div className="map-toolbar"><strong>Mapa</strong><button type="button" onClick={() => setUnavailable(true)}>Mapa indisponível</button></div><div className="map-canvas" onPointerUp={() => setMoved(true)}><span>Locais autorizados</span>{clusters.map((cluster, index) => <button className={`map-marker ${cluster.doctorIds.includes(selectedDoctorId ?? '') ? 'selected' : ''}`} style={{ left: `${25 + index * 28}%`, top: `${42 + index * 12}%` }} type="button" key={cluster.doctorIds.join('-')} onClick={() => onSelect(cluster.doctorIds[0]!)} aria-label={`${cluster.doctorIds.length} local(is) neste marcador`}>{cluster.doctorIds.length}</button>)}</div><button className="move-map" type="button" onClick={() => setMoved(true)}>Mover mapa</button>{moved && <button className="search-area" type="button" onClick={() => setMoved(false)}>Buscar nesta área</button>}<p>Rotas abrem no Google Maps. O Medário não oferece navegação própria.</p></section>;
}
