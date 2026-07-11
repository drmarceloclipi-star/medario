"use strict";

const editableFields = new Set(["rqe", "insurances", "location", "availability", "contacts"]);
const leadMetricFields = new Set(["profileViews", "externalContactOpens", "appointmentRequests"]);

function profileChangesFrom(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid profile changes");
  const changes = {};
  for (const [key, value] of Object.entries(input)) {
    if (!editableFields.has(key)) throw new Error("Unsupported profile field");
    if (key === "rqe" || key === "availability") {
      if (typeof value !== "string" || !value.trim() || value.length > 200) throw new Error("Invalid profile value");
      changes[key] = value.trim();
    }
    if (key === "insurances") {
      if (!Array.isArray(value) || value.length > 30 || value.some((item) => typeof item !== "string" || !item.trim() || item.length > 100)) throw new Error("Invalid insurance list");
      changes[key] = value.map((item) => item.trim());
    }
    if (key === "location") {
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid location");
      const location = {};
      for (const field of ["name", "address", "district", "city", "state"]) {
        if (value[field] !== undefined) {
          if (typeof value[field] !== "string" || !value[field].trim() || value[field].length > 200) throw new Error("Invalid location field");
          location[field] = value[field].trim();
        }
      }
      if (typeof value.authorized === "boolean") location.authorized = value.authorized;
      if (Object.keys(location).length === 0) throw new Error("Empty location");
      changes[key] = location;
    }
    if (key === "contacts") {
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid contacts");
      const contacts = {};
      for (const field of ["phone", "whatsApp"]) {
        if (value[field] !== undefined) {
          if (typeof value[field] !== "string" || !value[field].trim() || value[field].length > 40) throw new Error("Invalid contact");
          contacts[field] = value[field].trim();
        }
      }
      if (Object.keys(contacts).length === 0) throw new Error("Empty contacts");
      changes[key] = contacts;
    }
  }
  if (Object.keys(changes).length === 0) throw new Error("Empty profile changes");
  return changes;
}

function leadMetricsFrom(input) {
  const metrics = {};
  for (const field of leadMetricFields) {
    const value = input?.[field] ?? 0;
    if (!Number.isInteger(value) || value < 0) throw new Error("Invalid lead metric");
    metrics[field] = value;
  }
  return metrics;
}

function canCreateIdentifiedLead(action) {
  return action === "appointment_request" || action === "external_contact_identified";
}

module.exports = { canCreateIdentifiedLead, leadMetricsFrom, profileChangesFrom };
