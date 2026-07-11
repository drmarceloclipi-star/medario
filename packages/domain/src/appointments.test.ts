import { describe, expect, it } from "vitest";

import {
  canTransitionAppointment,
  integrationEvent,
  isSlotEligible,
  type AppointmentTypeConfig,
  type Slot,
} from "./appointments";

const now = new Date("2030-01-01T09:00:00.000Z");

const appointmentType: AppointmentTypeConfig = {
  id: "consulta-presencial",
  doctorId: "doctor-1",
  locationId: "clinic-1",
  modality: "in_person",
  durationMinutes: 30,
  bufferMinutes: 15,
  minimumLeadMinutes: 30,
  maximumWindowDays: 7,
  confirmationPolicy: "manual",
  cancellationPolicy: "cancelamento até 24h antes",
};

function slot(overrides: Partial<Slot> = {}): Slot {
  return {
    id: "slot-1",
    appointmentTypeId: appointmentType.id,
    doctorId: appointmentType.doctorId,
    locationId: appointmentType.locationId,
    startsAt: "2030-01-01T10:00:00.000Z",
    endsAt: "2030-01-01T10:45:00.000Z",
    status: "open",
    ...overrides,
  };
}

describe("slot elegível", () => {
  it("oferece apenas slot aberto, compatível, fresco e dentro da janela com duração e buffer", () => {
    expect(isSlotEligible(slot(), appointmentType, "available", now)).toBe(true);
  });

  it.each([
    ["médico diferente", slot({ doctorId: "doctor-2" }), "available"],
    ["local diferente", slot({ locationId: "clinic-2" }), "available"],
    ["tipo de consulta diferente", slot({ appointmentTypeId: "teleconsulta" }), "available"],
    ["slot bloqueado", slot({ status: "blocked" }), "available"],
    ["agenda com conflito externo", slot(), "conflict"],
    ["agenda sem frescor", slot(), "stale"],
    ["agenda indisponível", slot(), "unavailable"],
    ["antes da antecedência mínima", slot({ startsAt: "2030-01-01T09:20:00.000Z", endsAt: "2030-01-01T10:05:00.000Z" }), "available"],
    ["depois da janela máxima", slot({ startsAt: "2030-01-09T10:00:00.000Z", endsAt: "2030-01-09T10:45:00.000Z" }), "available"],
    ["sem buffer reservado", slot({ endsAt: "2030-01-01T10:30:00.000Z" }), "available"],
  ] as const)("não oferece %s", (_reason, unavailableSlot, calendar) => {
    expect(isSlotEligible(unavailableSlot, appointmentType, calendar, now)).toBe(false);
  });
});

describe("transições de agendamento", () => {
  it("permite somente transições rastreáveis do ciclo da reserva", () => {
    expect(canTransitionAppointment("requested", "held")).toBe(true);
    expect(canTransitionAppointment("held", "confirmed")).toBe(true);
    expect(canTransitionAppointment("confirmed", "cancel_requested")).toBe(true);
    expect(canTransitionAppointment("cancel_requested", "cancelled")).toBe(true);
    expect(canTransitionAppointment("confirmed", "completed")).toBe(true);
  });

  it("não ressuscita nem confirma estados finais ou pedidos recusados", () => {
    expect(canTransitionAppointment("declined", "confirmed")).toBe(false);
    expect(canTransitionAppointment("cancelled", "confirmed")).toBe(false);
    expect(canTransitionAppointment("completed", "cancelled")).toBe(false);
    expect(canTransitionAppointment("no_show", "confirmed")).toBe(false);
  });
});

describe("evento mínimo de integração", () => {
  it("espelha somente período e identificador Medário, sem PII", () => {
    const event = integrationEvent(slot(), "appointment-1");

    expect(event).toEqual({
      startsAt: "2030-01-01T10:00:00.000Z",
      endsAt: "2030-01-01T10:45:00.000Z",
      medarioAppointmentId: "appointment-1",
    });
    expect(Object.keys(event).sort()).toEqual(["endsAt", "medarioAppointmentId", "startsAt"]);
    expect(JSON.stringify(event)).not.toMatch(/patient|email|phone|symptom|nome|cpf/i);
  });
});
