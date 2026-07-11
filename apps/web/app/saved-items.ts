import { isMaterialAlertEvent, type MaterialAlertEvent, type SavedSearchCriteria, type VisitorFavorite, type VisitorSavedSearch } from "@medario/domain";

export type StoragePort = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type PersistedSavedItems = { favorites: VisitorFavorite[]; searches: VisitorSavedSearch[] };
const storageKey = "medario.saved-items.v1";

function criteriaFrom(value: unknown): SavedSearchCriteria {
  if (!value || typeof value !== 'object') return {};
  const candidate = value as Record<string, unknown>;
  return {
    ...(typeof candidate.specialty === 'string' ? { specialty: candidate.specialty } : {}),
    ...(typeof candidate.city === 'string' ? { city: candidate.city } : {}),
    ...(typeof candidate.insurance === 'string' ? { insurance: candidate.insurance } : {}),
    ...(candidate.modality === 'in_person' || candidate.modality === 'telemedicine' ? { modality: candidate.modality } : {}),
  };
}

function read(storage: StoragePort): PersistedSavedItems {
  try {
    const value = storage.getItem(storageKey);
    const parsed = value ? JSON.parse(value) as Partial<PersistedSavedItems> : {};
    const favorites = Array.isArray(parsed.favorites) ? parsed.favorites.filter((item): item is VisitorFavorite => Boolean(item && typeof item.doctorId === 'string' && typeof item.createdAt === 'string')).map((item) => ({ doctorId: item.doctorId, createdAt: item.createdAt })) : [];
    const searches = Array.isArray(parsed.searches) ? parsed.searches.filter((item): item is VisitorSavedSearch => Boolean(item && typeof item.id === 'string' && typeof item.createdAt === 'string')).map((item) => ({ id: item.id, createdAt: item.createdAt, criteria: criteriaFrom(item.criteria) })) : [];
    return { favorites, searches };
  } catch { return { favorites: [], searches: [] }; }
}

export function createSavedItemsStore(storage: StoragePort, now = new Date()) {
  let state = read(storage);
  const persist = () => storage.setItem(storageKey, JSON.stringify(state));
  persist();
  return {
    favorites: () => state.favorites,
    savedSearches: () => state.searches,
    favorite: (doctorId: string) => { if (!state.favorites.some((item) => item.doctorId === doctorId)) { state = { ...state, favorites: [...state.favorites, { doctorId, createdAt: now.toISOString() }] }; persist(); } return state.favorites; },
    unfavorite: (doctorId: string) => { state = { ...state, favorites: state.favorites.filter((item) => item.doctorId !== doctorId) }; persist(); return state.favorites; },
    saveSearch: ({ criteria }: { criteria: SavedSearchCriteria }) => { const safeCriteria = criteriaFrom(criteria); const id = `${now.getTime()}-${Object.values(safeCriteria).filter(Boolean).join('-')}`; const search: VisitorSavedSearch = { id, criteria: safeCriteria, createdAt: now.toISOString() }; state = { ...state, searches: [search, ...state.searches] }; persist(); return search; },
    removeSearch: (id: string) => { state = { ...state, searches: state.searches.filter((item) => item.id !== id) }; persist(); },
    canCreateAlert: (isAccount: boolean, notificationsEnabled: boolean, event: string): event is MaterialAlertEvent => isAccount && notificationsEnabled && isMaterialAlertEvent(event),
  };
}
