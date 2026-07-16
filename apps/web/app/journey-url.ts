import type { SearchFilters } from './search';

export const allowedJourneyParameters = ['specialty', 'city', 'insurance', 'modality', 'entry'] as const;
export type JourneyEntry = 'directory-joinville' | undefined;
export type JourneyFilters = SearchFilters;

const allowedValues = {
  specialty: new Set(['psiquiatria', 'psicologia', 'pediatria', 'dermatologia', 'cardiologia']),
  city: new Set(['joinville']),
  insurance: new Set(['unimed']),
  modality: new Set(['in_person', 'telemedicine']),
  entry: new Set(['directory-joinville']),
} as const;

function allowedValue<Key extends keyof typeof allowedValues>(key: Key, value: string | null) {
  if (!value) return undefined;
  const normalized = value.trim().toLocaleLowerCase('pt-BR');
  return allowedValues[key].has(normalized as never) ? normalized : undefined;
}

export function readJourneyUrl(input: string | URLSearchParams) {
  const params = typeof input === 'string' ? new URL(input, 'https://app.medario.com.br').searchParams : input;
  const filters: JourneyFilters = {};
  const specialty = allowedValue('specialty', params.get('specialty'));
  const city = allowedValue('city', params.get('city'));
  const insurance = allowedValue('insurance', params.get('insurance'));
  const modality = allowedValue('modality', params.get('modality'));
  if (specialty) filters.specialty = specialty;
  if (city) filters.city = city;
  if (insurance) filters.insurance = insurance;
  if (modality) filters.modality = modality as JourneyFilters['modality'];

  return { filters, entry: allowedValue('entry', params.get('entry')) as JourneyEntry };
}

export function journeyUrl(filters: JourneyFilters) {
  const params = new URLSearchParams();
  for (const key of allowedJourneyParameters) {
    if (key === 'entry') continue;
    const value = filters[key];
    const normalized = value ? allowedValue(key, value) : undefined;
    if (normalized) params.set(key, normalized);
  }
  const query = params.toString();
  return query ? `/?${query}` : '/';
}
