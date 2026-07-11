import { describe, expect, it } from "vitest";

import { createSavedItemsStore, savedCriteriaKey } from "../app/saved-items";

function createStorage() {
  const values = new Map<string, string>();

  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

describe("saved items", () => {
  it("adds, lists and removes a favorite on the current device", () => {
    const store = createSavedItemsStore(createStorage());

    store.favorite("doctor-1");
    store.favorite("doctor-1");

    expect(store.favorites().map((favorite) => favorite.doctorId)).toEqual(["doctor-1"]);

    store.unfavorite("doctor-1");

    expect(store.favorites()).toEqual([]);
  });

  it("saves only derived criteria regardless of raw text or consent", () => {
    const store = createSavedItemsStore(createStorage());

    const unsafeInput = {
      criteria: { city: "joinville", insurance: "unimed", specialty: "psiquiatria" },
      rawQuery: "Estou com dor rara que não aparece em nenhum detector",
    };
    store.saveSearch(unsafeInput);

    const [savedSearch] = store.savedSearches();

    expect(savedSearch?.criteria).toEqual({ city: "joinville", insurance: "unimed", specialty: "psiquiatria" });
    expect(savedSearch).not.toHaveProperty("rawQuery");
    expect(JSON.stringify(savedSearch)).not.toContain("dor rara");
  });

  it("sanitizes legacy saved searches already containing raw text", () => {
    const storage = createStorage();
    storage.setItem("medario.saved-items.v1", JSON.stringify({ favorites: [], searches: [{ id: "legacy", createdAt: "2026-07-01", criteria: { city: "joinville" }, rawQuery: "sintoma sensível", exactLocation: { lat: 1 } }] }));

    const store = createSavedItemsStore(storage);

    expect(store.savedSearches()).toEqual([{ id: "legacy", createdAt: "2026-07-01", criteria: { city: "joinville" } }]);
    expect(storage.getItem("medario.saved-items.v1")).not.toContain("sintoma sensível");
  });

  it("removes a saved search", () => {
    const store = createSavedItemsStore(createStorage());

    store.saveSearch({ criteria: { city: "joinville" } });
    const [savedSearch] = store.savedSearches();

    store.removeSearch(savedSearch!.id);

    expect(store.savedSearches()).toEqual([]);
  });

  it("creates alerts only for material changes for opted-in account holders", () => {
    const store = createSavedItemsStore(createStorage());

    expect(store.canCreateAlert(true, true, "new_compatible_doctor")).toBe(true);
    expect(store.canCreateAlert(true, true, "confirmed_insurance")).toBe(true);
    expect(store.canCreateAlert(true, true, "confirmed_slot")).toBe(true);
    expect(store.canCreateAlert(false, true, "confirmed_slot")).toBe(false);
    expect(store.canCreateAlert(true, false, "confirmed_slot")).toBe(false);
    expect(store.canCreateAlert(true, true, "promotion")).toBe(false);
  });

  it("uses a stable key to avoid syncing the same criteria twice", () => {
    expect(savedCriteriaKey({ city: "joinville", specialty: "psiquiatria" })).toBe(savedCriteriaKey({ specialty: "psiquiatria", city: "joinville" }));
  });
});
