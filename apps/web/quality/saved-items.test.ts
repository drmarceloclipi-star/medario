import { describe, expect, it } from "vitest";

import { createSavedItemsStore } from "../app/saved-items";

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
    const store = createSavedItemsStore(createStorage(), false);

    store.favorite("doctor-1");
    store.favorite("doctor-1");

    expect(store.favorites().map((favorite) => favorite.doctorId)).toEqual(["doctor-1"]);

    store.unfavorite("doctor-1");

    expect(store.favorites()).toEqual([]);
  });

  it("saves derived criteria but never raw health text without consent", () => {
    const store = createSavedItemsStore(createStorage(), false);

    store.saveSearch({
      criteria: { city: "joinville", insurance: "unimed", specialty: "psiquiatria" },
      rawQuery: "Estou com ansiedade e preciso de psiquiatra",
    });

    const [savedSearch] = store.savedSearches();

    expect(savedSearch?.criteria).toEqual({ city: "joinville", insurance: "unimed", specialty: "psiquiatria" });
    expect(savedSearch).not.toHaveProperty("rawQuery");
    expect(JSON.stringify(savedSearch)).not.toContain("ansiedade");
  });

  it("keeps raw health text only after explicit health consent", () => {
    const store = createSavedItemsStore(createStorage(), true);

    store.saveSearch({
      criteria: { specialty: "psiquiatria" },
      rawQuery: "Estou com ansiedade e preciso de psiquiatra",
    });

    expect(store.savedSearches()[0]).toMatchObject({
      criteria: { specialty: "psiquiatria" },
      rawQuery: "Estou com ansiedade e preciso de psiquiatra",
    });
  });

  it("removes a saved search", () => {
    const store = createSavedItemsStore(createStorage(), false);

    store.saveSearch({ criteria: { city: "joinville" } });
    const [savedSearch] = store.savedSearches();

    store.removeSearch(savedSearch!.id);

    expect(store.savedSearches()).toEqual([]);
  });

  it("creates alerts only for material changes for opted-in account holders", () => {
    const store = createSavedItemsStore(createStorage(), false);

    expect(store.canCreateAlert(true, true, "new_compatible_doctor")).toBe(true);
    expect(store.canCreateAlert(true, true, "confirmed_insurance")).toBe(true);
    expect(store.canCreateAlert(true, true, "confirmed_slot")).toBe(true);
    expect(store.canCreateAlert(false, true, "confirmed_slot")).toBe(false);
    expect(store.canCreateAlert(true, false, "confirmed_slot")).toBe(false);
    expect(store.canCreateAlert(true, true, "promotion")).toBe(false);
  });
});
