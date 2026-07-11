export type SavedSearchCriteria = { specialty?: string; city?: string; insurance?: string; modality?: "in_person" | "telemedicine" };
export type MaterialAlertEvent = "new_compatible_doctor" | "confirmed_insurance" | "confirmed_slot";
export type VisitorFavorite = { doctorId: string; createdAt: string };
export type VisitorSavedSearch = { id: string; criteria: SavedSearchCriteria; createdAt: string };

export function isMaterialAlertEvent(value: string): value is MaterialAlertEvent {
  return value === "new_compatible_doctor" || value === "confirmed_insurance" || value === "confirmed_slot";
}
