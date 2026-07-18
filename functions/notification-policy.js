"use strict";

const events = ["appointment_confirmed", "profile_updated", "saved_search_material"];
const channels = ["email", "whatsapp", "push"];

function defaultPreferences() {
  return Object.fromEntries(events.map((event) => [event, Object.fromEntries(channels.map((channel) => [channel, false]))]));
}

function preferencesFrom(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid notification preferences");
  const unknownEvents = Object.keys(input).filter((event) => !events.includes(event));
  if (unknownEvents.length) throw new Error("Unknown notification event");
  const preferences = defaultPreferences();
  for (const event of events) {
    if (input[event] === undefined) continue;
    if (!input[event] || typeof input[event] !== "object" || Array.isArray(input[event])) throw new Error("Invalid event preferences");
    for (const key of Object.keys(input[event])) {
      if (!channels.includes(key) || typeof input[event][key] !== "boolean") throw new Error("Invalid notification channel");
      preferences[event][key] = input[event][key];
    }
  }
  return preferences;
}

function preferencesFromDocument(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return defaultPreferences();
  const preferenceFields = Object.fromEntries(events.flatMap((event) => (
    Object.prototype.hasOwnProperty.call(input, event) ? [[event, input[event]]] : []
  )));
  return preferencesFrom(preferenceFields);
}

function notificationEnabled(preferences, event, channel) {
  return events.includes(event) && channels.includes(channel) && preferencesFrom(preferences || {})[event][channel] === true;
}

function enabledChannels(preferences, event) {
  if (!events.includes(event)) return [];
  const normalized = preferencesFrom(preferences || {});
  return channels.filter((channel) => normalized[event][channel] === true);
}

function providerlessDeliveryState(preferences, event, channel) {
  return notificationEnabled(preferences, event, channel) ? "blocked_provider_not_configured" : "suppressed_revoked";
}

function notificationOutboxRecord({ id, event, channel, recipientUid, subjectRef, now }) {
  if (!events.includes(event) || !channels.includes(channel) || typeof recipientUid !== "string" || typeof subjectRef !== "string") throw new Error("Invalid notification outbox record");
  return { id, event, channel, recipientUid, subjectRef, state: "pending", attempts: 0, createdAt: now };
}

function safePushMessage(event) {
  const messages = {
    appointment_confirmed: {
      title: "Agendamento atualizado",
      body: "Abra o Medário para ver os detalhes.",
      destination: "appointments",
    },
    profile_updated: {
      title: "Perfil atualizado",
      body: "Um perfil salvo recebeu informações novas.",
      destination: "saved_items",
    },
    saved_search_material: {
      title: "Busca salva atualizada",
      body: "Há uma novidade compatível. Abra o Medário para consultar.",
      destination: "saved_items",
    },
  };
  const message = messages[event];
  if (!message) throw new Error("Unknown notification event");
  return message;
}

module.exports = { channels, defaultPreferences, enabledChannels, events, notificationEnabled, notificationOutboxRecord, preferencesFrom, preferencesFromDocument, providerlessDeliveryState, safePushMessage };
