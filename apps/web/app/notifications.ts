import type { NotificationChannel, NotificationEvent } from "@medario/domain";
import { canDeliverNotification as canDeliver } from "@medario/domain";

export function buildAppointmentReminder(input: { doctorName: string; startsAt: string; location: string }) {
  return { title: "Lembrete de consulta", body: `${input.doctorName} · ${input.startsAt} · ${input.location}` };
}

export function canDeliverNotification(input: { isAccount: boolean; enabled: boolean; channel: NotificationChannel; event: NotificationEvent }) {
  return canDeliver(input);
}

export function safeDeliveryFailure(input: { code: string; notificationId: string }) {
  return { code: input.code, notificationId: input.notificationId };
}
