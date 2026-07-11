export type EntityId = string;
export type ISODateString = string;
export type Slug = string;

export type AppointmentType = "in_person" | "telemedicine";
export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";
export type LeadStatus = "new" | "contacted" | "converted" | "lost";
export type AppointmentRequestStatus = "requested" | "confirmed" | "cancelled" | "completed";

export interface Specialty {
  id: EntityId;
  slug: Slug;
  name: string;
  description?: string;
}

export interface Location {
  id: EntityId;
  city: string;
  state: string;
  district?: string;
  addressLine?: string;
  latitude?: number;
  longitude?: number;
}

export interface DoctorAvailability {
  nextAvailableAt?: ISODateString;
  acceptsNewPatients: boolean;
}

export interface Doctor {
  id: EntityId;
  slug: Slug;
  name: string;
  crm: string;
  rqe?: string;
  bio?: string;
  avatarUrl?: string;
  specialties: Specialty[];
  insurances: string[];
  languages: string[];
  appointmentTypes: AppointmentType[];
  locations: Location[];
  verificationStatus: VerificationStatus;
  sponsored: boolean;
  availability?: DoctorAvailability;
}

export interface Patient {
  id: EntityId;
  email: string;
  displayName?: string;
  city?: string;
  preferredInsurance?: string;
  preferredAppointmentType?: AppointmentType;
  createdAt: ISODateString;
}

export interface ProfessionalAccount {
  id: EntityId;
  doctorId: EntityId;
  email: string;
  plan: "free" | "pro";
  profileCompletion: number;
  createdAt: ISODateString;
}

export interface AppointmentRequest {
  id: EntityId;
  doctorId: EntityId;
  patientId: EntityId;
  appointmentType: AppointmentType;
  requestedAt: ISODateString;
  preferredDates: ISODateString[];
  message?: string;
  status: AppointmentRequestStatus;
}

export interface Favorite {
  id: EntityId;
  patientId: EntityId;
  doctorId: EntityId;
  createdAt: ISODateString;
}

export interface SavedSearch {
  id: EntityId;
  patientId: EntityId;
  query: string;
  specialtyIds: EntityId[];
  insurance?: string;
  city?: string;
  appointmentType?: AppointmentType;
  createdAt: ISODateString;
}

export type SearchSource = "composer" | "quick_prompt" | "suggestion" | "history";

export interface SearchSuggestion {
  id: EntityId;
  label: string;
  detail: string;
  query: string;
  specialtyId?: EntityId;
}

export interface SearchHistoryEntry {
  id: EntityId;
  query: string;
  source: SearchSource;
  createdAt: ISODateString;
}

export interface SearchSession {
  query: string;
  source: SearchSource;
  submittedAt: ISODateString;
}

export interface Lead {
  id: EntityId;
  doctorId: EntityId;
  patientId?: EntityId;
  source: "search" | "profile" | "sponsored" | "direct";
  status: LeadStatus;
  createdAt: ISODateString;
}

export interface AnalyticsEvent {
  id: EntityId;
  name: "search_submitted" | "doctor_viewed" | "favorite_added" | "appointment_requested" | "lead_created";
  actorId?: EntityId;
  doctorId?: EntityId;
  occurredAt: ISODateString;
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
}
