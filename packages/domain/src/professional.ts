export interface ProfessionalAccountScope {
  doctorId: string;
}

export function professionalAccountOwnsDoctor(
  account: ProfessionalAccountScope,
  doctorId: string,
): boolean {
  return account.doctorId === doctorId;
}

export function publicProfileSnapshot<T extends Record<string, unknown>>(
  confirmed: T,
  _proposedChange: Partial<T>,
): T {
  return { ...confirmed };
}

export interface AnonymousLeadSignal {
  doctorId: string;
}

export interface AnonymousLeadMetric {
  doctorId: string;
  count: number;
}

export function aggregateAnonymousLeads(
  signals: readonly AnonymousLeadSignal[],
  doctorId: string,
): AnonymousLeadMetric {
  return {
    doctorId,
    count: signals.filter((signal) => signal.doctorId === doctorId).length,
  };
}

export type ExplicitLeadAction = "appointment_request" | "external_contact_identified";

export interface IdentifiedLead {
  patientId: string;
  action: ExplicitLeadAction;
}

export function createIdentifiedLead(action: string, patientId: string): IdentifiedLead {
  if (action !== "appointment_request" && action !== "external_contact_identified") {
    throw new Error("Identified leads require an explicit patient action");
  }

  return { patientId, action };
}

export interface GoogleCalendarAuthorization {
  doctorId: string;
  integrationCalendarId: string;
  status: "active" | "revoked";
}

export function revokeGoogleCalendarAuthorization(
  authorization: GoogleCalendarAuthorization,
): GoogleCalendarAuthorization {
  return { ...authorization, status: "revoked" };
}
