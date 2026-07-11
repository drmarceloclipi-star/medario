export type ConfirmationPolicy = "immediate" | "manual";
export type AppointmentStatus = "requested" | "held" | "confirmed" | "declined" | "reschedule_proposed" | "cancel_requested" | "cancelled" | "completed" | "no_show";
export type CalendarAvailability = "available" | "conflict" | "stale" | "unavailable";

export type AppointmentTypeConfig = {
  id: string;
  doctorId: string;
  locationId: string;
  modality: "in_person" | "telemedicine";
  durationMinutes: number;
  bufferMinutes: number;
  minimumLeadMinutes: number;
  maximumWindowDays: number;
  confirmationPolicy: ConfirmationPolicy;
  cancellationPolicy: string;
};

export type Slot = {
  id: string;
  appointmentTypeId: string;
  doctorId: string;
  locationId: string;
  startsAt: string;
  endsAt: string;
  status: "open" | "held" | "reserved" | "blocked";
};

export type IntegrationEvent = { startsAt: string; endsAt: string; medarioAppointmentId: string };

export function isSlotEligible(slot: Slot, config: AppointmentTypeConfig, calendar: CalendarAvailability, now = new Date()) {
  const start = new Date(slot.startsAt).getTime();
  const end = new Date(slot.endsAt).getTime();
  const maxStart = now.getTime() + config.maximumWindowDays * 24 * 60 * 60 * 1000;
  const reservedMinutes = (end - start) / (60 * 1000);
  return slot.status === "open" &&
    slot.appointmentTypeId === config.id &&
    slot.doctorId === config.doctorId &&
    slot.locationId === config.locationId &&
    calendar === "available" &&
    reservedMinutes >= config.durationMinutes + config.bufferMinutes &&
    start >= now.getTime() + config.minimumLeadMinutes * 60 * 1000 &&
    start <= maxStart;
}

export function canTransitionAppointment(from: AppointmentStatus, to: AppointmentStatus) {
  const allowed: Record<AppointmentStatus, AppointmentStatus[]> = {
    requested: ["held", "confirmed", "declined", "reschedule_proposed", "cancel_requested"],
    held: ["confirmed", "declined", "cancelled"],
    confirmed: ["reschedule_proposed", "cancel_requested", "completed", "no_show"],
    declined: [],
    reschedule_proposed: ["requested", "cancel_requested", "cancelled"],
    cancel_requested: ["cancelled", "confirmed"],
    cancelled: [],
    completed: [],
    no_show: [],
  };
  return allowed[from].includes(to);
}

export function integrationEvent(slot: Slot, appointmentId: string): IntegrationEvent {
  return { startsAt: slot.startsAt, endsAt: slot.endsAt, medarioAppointmentId: appointmentId };
}
