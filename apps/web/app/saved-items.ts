import { isMaterialAlertEvent, type MaterialAlertEvent, type SavedSearchCriteria, type VisitorFavorite, type VisitorSavedSearch } from "@medario/domain";

export type StoragePort = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type PersistedSavedItems = { favorites: VisitorFavorite[]; searches: VisitorSavedSearch[] };
const storageKey = "medario.saved-items.v1";
const ninetyDays = 90 * 24 * 60 * 60 * 1000;

function read(storage: StoragePort, now: Date): PersistedSavedItems {
  try {
    const value = storage.getItem(storageKey);
    const parsed = value ? JSON.parse(value) as PersistedSavedItems : { favorites: [], searches: [] };
    return { favorites: parsed.favorites ?? [], searches: (parsed.searches ?? []).filter((item) => !item.expiresAt || new Date(item.expiresAt).getTime() > now.getTime()) };
  } catch { return { favorites: [], searches: [] }; }
}

export function createSavedItemsStore(storage: StoragePort, healthConsent: boolean, now = new Date()) {
  let state = read(storage, now);
  const persist = () => storage.setItem(storageKey, JSON.stringify(state));
  return {
    favorites: () => state.favorites,
    savedSearches: () => state.searches,
    favorite: (doctorId: string) => { if (!state.favorites.some((item) => item.doctorId === doctorId)) { state = { ...state, favorites: [...state.favorites, { doctorId, createdAt: now.toISOString() }] }; persist(); } return state.favorites; },
    unfavorite: (doctorId: string) => { state = { ...state, favorites: state.favorites.filter((item) => item.doctorId !== doctorId) }; persist(); return state.favorites; },
    saveSearch: ({ criteria, rawQuery }: { criteria: SavedSearchCriteria; rawQuery?: string }) => { const id = `${now.getTime()}-${Object.values(criteria).filter(Boolean).join('-')}`; const sensitive = Boolean(rawQuery && /\b(ansiedade|depress[aã]o|dor|febre|tosse|sintoma|crise|sangramento|falta de ar)\b/i.test(rawQuery)); const search: VisitorSavedSearch = { id, criteria, createdAt: now.toISOString(), ...(rawQuery && (!sensitive || healthConsent) ? { rawQuery, expiresAt: new Date(now.getTime() + ninetyDays).toISOString() } : {}) }; state = { ...state, searches: [search, ...state.searches] }; persist(); return search; },
    removeSearch: (id: string) => { state = { ...state, searches: state.searches.filter((item) => item.id !== id) }; persist(); },
    canCreateAlert: (isAccount: boolean, notificationsEnabled: boolean, event: string): event is MaterialAlertEvent => isAccount && notificationsEnabled && isMaterialAlertEvent(event),
  };
}
