"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { userSubcollectionsForDeletion } = require("./user-cleanup-policy");

test("account deletion includes synchronized favorites and saved searches", () => {
  assert.deepEqual(userSubcollectionsForDeletion(), ["interests", "search_events", "favorites", "savedSearches"]);
});
