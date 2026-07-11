"use strict";

const allowedCriteria = new Set(["specialty", "city", "insurance", "modality"]);

function savedSearchCriteriaFrom(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid saved search criteria");
  const keys = Object.keys(input);
  if (keys.some((key) => !allowedCriteria.has(key))) throw new Error("Unsupported saved search criterion");
  const criteria = {};
  for (const key of keys) {
    const value = input[key];
    if (typeof value !== "string" || !value.trim() || value.length > 100) throw new Error("Invalid saved search criterion");
    if (key === "modality" && value !== "in_person" && value !== "telemedicine") throw new Error("Invalid modality");
    criteria[key] = value.trim();
  }
  if (!keys.length) throw new Error("Empty saved search criteria");
  return criteria;
}

function savedSearchRecord({ id, criteria, alertEnabled, now }) {
  const safeCriteria = savedSearchCriteriaFrom(criteria);
  if (typeof alertEnabled !== "boolean") throw new Error("Invalid alert preference");
  return { id, criteria: safeCriteria, alertEnabled, createdAt: now, updatedAt: now, version: 1 };
}

module.exports = { savedSearchCriteriaFrom, savedSearchRecord };
