import { journeyUrl } from './journey-url';

export type SearchFilters = {
  specialty?: string;
  city?: string;
  insurance?: string;
  modality?: "in_person" | "telemedicine";
};

export type DerivedSearch = {
  filters: SearchFilters;
  hasHealthSignal: boolean;
};

const healthSignalPattern = /\b(ansiedade|depress[aã]o|dor|febre|tosse|sintoma|crise|sangramento|falta de ar|dor no peito)\b/i;
const specialties = [
  ["psiquiatria", /\bpsiquiatr(a|ia)\b/i],
  ["psicologia", /\bpsic[oó]log(a|ia)?\b/i],
  ["pediatria", /\bpediatr(a|ia)\b/i],
  ["dermatologia", /\bdermatolog(a|ia)\b/i],
  ["cardiologia", /\bcardiolog(a|ia)\b/i],
] as const;

const cities = [
  ["joinville", /\bjoinville\b/i],
] as const;

const insurances = [
  ["unimed", /\bunimed\b/i],
] as const;

export function hasHealthSignal(query: string) {
  return healthSignalPattern.test(query);
}

export function deriveSearch(query: string): DerivedSearch {
  const filters: SearchFilters = {};

  const specialty = specialties.find(([, pattern]) => pattern.test(query));
  const city = cities.find(([, pattern]) => pattern.test(query));
  const insurance = insurances.find(([, pattern]) => pattern.test(query));

  if (specialty) filters.specialty = specialty[0];
  if (city) filters.city = city[0];
  if (insurance) filters.insurance = insurance[0];
  if (/\b(online|teleconsulta|telemedicina)\b/i.test(query)) filters.modality = "telemedicine";
  if (/\b(presencial|consult[oó]rio|cl[ií]nica)\b/i.test(query)) filters.modality = "in_person";

  return { filters, hasHealthSignal: hasHealthSignal(query) };
}

export function searchUrl({ filters }: DerivedSearch) {
  // Keep the established API while making every emitted URL pass the shared contract.
  return journeyUrl(filters);
}

export function shouldPersistSearch(query: string, healthConsent: boolean) {
  return !hasHealthSignal(query) || healthConsent;
}

const historyMaxAgeMs = 90 * 24 * 60 * 60 * 1000;

export function isHistoryEntryCurrent(entry: { createdAt: string }, now = new Date()) {
  const createdAt = new Date(entry.createdAt).getTime();
  return Number.isFinite(createdAt) && createdAt <= now.getTime() && now.getTime() - createdAt <= historyMaxAgeMs;
}
