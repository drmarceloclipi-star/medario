import { describe, expect, it } from "vitest";

import {
  buildAppointmentReminder,
  canDeliverNotification,
  safeDeliveryFailure,
} from "../app/notifications";

describe("notificações seguras", () => {
  it("constrói lembrete de agendamento somente com dados operacionais", () => {
    const reminder = buildAppointmentReminder({
      doctorName: "Dra. Marina Andrade",
      startsAt: "2026-07-15T14:30:00-03:00",
      location: "Clínica Central",
    });

    expect(reminder).toEqual({
      title: "Lembrete de consulta",
      body: "Dra. Marina Andrade · 2026-07-15T14:30:00-03:00 · Clínica Central",
    });
    expect(JSON.stringify(reminder)).not.toMatch(/sintoma|especialidade|diagnóstico/i);
  });

  it("entrega somente para paciente com conta, preferência ativa e canal permitido", () => {
    expect(
      canDeliverNotification({
        isAccount: true,
        enabled: true,
        channel: "email",
        event: "appointment_confirmed",
      }),
    ).toBe(true);

    expect(
      canDeliverNotification({
        isAccount: false,
        enabled: true,
        channel: "push",
        event: "saved_search_material",
      }),
    ).toBe(false);
    expect(
      canDeliverNotification({
        isAccount: true,
        enabled: false,
        channel: "whatsapp",
        event: "profile_updated",
      }),
    ).toBe(false);
    expect(
      canDeliverNotification({
        isAccount: true,
        enabled: true,
        channel: "sms" as never,
        event: "appointment_confirmed",
      }),
    ).toBe(false);
  });

  it("expõe falha de entrega por código e identificador, sem conteúdo da notificação", () => {
    const failure = safeDeliveryFailure({
      code: "provider_unavailable",
      notificationId: "notification-17",
    });

    expect(failure).toEqual({
      code: "provider_unavailable",
      notificationId: "notification-17",
    });
    expect(JSON.stringify(failure)).not.toMatch(/doctor|location|symptom|specialty|message|body/i);
  });
});
