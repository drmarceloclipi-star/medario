import type { AppointmentType, Doctor } from "@medario/domain";

import type { DerivedSearch } from "./search";

export type ResultSort = "relevance" | "distance" | "availability" | "updated";
export type AvailabilityState = "confirmed_slot" | "accepts_new_patients" | "to_confirm";
export type InsuranceState = "confirmed" | "informed";

export type DirectoryDoctor = Doctor & {
  updatedAt: string;
  distanceKm?: number;
  availabilityState: AvailabilityState;
  insuranceDetails: Array<{ name: string; status: InsuranceState; confirmedAt?: string }>;
  mapLocation: { latitude: number; longitude: number; authorized: boolean };
};

const specialty = { id: "specialty-psychiatry", slug: "psiquiatria", name: "Psiquiatria" };
const joinville = { id: "joinville-centro", city: "Joinville", state: "SC", district: "Centro" };

const directoryDoctors: DirectoryDoctor[] = [
  {
    id: "doctor-marina-alves", slug: "dra-marina-alves", name: "Dra. Marina Alves", crm: "CRM-SC 12345", rqe: "RQE 6789",
    specialties: [specialty], insurances: ["Unimed", "Particular"], languages: ["Português"], appointmentTypes: ["in_person", "telemedicine"], locations: [joinville], verificationStatus: "verified", sponsored: false,
    availability: { acceptsNewPatients: true, nextAvailableAt: "2026-07-15T13:00:00-03:00" }, availabilityState: "confirmed_slot", updatedAt: "2026-07-07T09:00:00-03:00", distanceKm: 2.1,
    insuranceDetails: [{ name: "Unimed", status: "confirmed", confirmedAt: "2026-07-07" }, { name: "Particular", status: "confirmed", confirmedAt: "2026-07-07" }],
    mapLocation: { latitude: -26.3044, longitude: -48.8461, authorized: true },
  },
  {
    id: "doctor-helena-costa", slug: "dra-helena-costa", name: "Dra. Helena Costa", crm: "CRM-SC 24581", rqe: "RQE 7312",
    specialties: [specialty], insurances: ["Unimed"], languages: ["Português", "Inglês"], appointmentTypes: ["telemedicine"], locations: [joinville], verificationStatus: "verified", sponsored: false,
    availability: { acceptsNewPatients: true }, availabilityState: "accepts_new_patients", updatedAt: "2026-07-10T11:00:00-03:00", distanceKm: 4.8,
    insuranceDetails: [{ name: "Unimed", status: "informed" }],
    mapLocation: { latitude: -26.305, longitude: -48.8465, authorized: true },
  },
  {
    id: "doctor-rafael-nunes", slug: "dr-rafael-nunes", name: "Dr. Rafael Nunes", crm: "CRM-SC 19024", rqe: "RQE 5571",
    specialties: [specialty], insurances: ["Particular"], languages: ["Português"], appointmentTypes: ["in_person"], locations: [{ ...joinville, id: "joinville-america", district: "América" }], verificationStatus: "pending", sponsored: false,
    availability: { acceptsNewPatients: false }, availabilityState: "to_confirm", updatedAt: "2026-07-05T10:00:00-03:00", distanceKm: 1.4,
    insuranceDetails: [{ name: "Particular", status: "confirmed", confirmedAt: "2026-07-05" }],
    mapLocation: { latitude: -26.33, longitude: -48.85, authorized: false },
  },
  {
    id: "doctor-caio-vasconcelos", slug: "dr-caio-vasconcelos", name: "Dr. Caio Vasconcelos", crm: "CRM-SC 30188", rqe: "RQE 8120",
    specialties: [specialty], insurances: ["Unimed"], languages: ["Português"], appointmentTypes: ["in_person", "telemedicine"], locations: [joinville], verificationStatus: "verified", sponsored: true,
    availability: { acceptsNewPatients: true }, availabilityState: "accepts_new_patients", updatedAt: "2026-07-08T13:00:00-03:00", distanceKm: 3.2,
    insuranceDetails: [{ name: "Unimed", status: "confirmed", confirmedAt: "2026-07-08" }],
    mapLocation: { latitude: -26.32, longitude: -48.84, authorized: true },
  },
];

function availabilityRank(state: AvailabilityState) {
  return state === "confirmed_slot" ? 0 : state === "accepts_new_patients" ? 1 : 2;
}

function matches(doctor: DirectoryDoctor, filters: DerivedSearch["filters"]) {
  if (filters.specialty && !doctor.specialties.some((item) => item.slug === filters.specialty)) return false;
  if (filters.city && !doctor.locations.some((item) => item.city.toLowerCase() === filters.city)) return false;
  if (filters.insurance && !doctor.insuranceDetails.some((item) => item.name.toLowerCase() === filters.insurance)) return false;
  if (filters.modality && !doctor.appointmentTypes.includes(filters.modality as AppointmentType)) return false;
  return true;
}

function compareOrganic(sort: ResultSort, patientLocationAuthorized: boolean) {
  return (left: DirectoryDoctor, right: DirectoryDoctor) => {
    if (sort === "distance" && patientLocationAuthorized) {
      const distance = (left.distanceKm ?? Number.POSITIVE_INFINITY) - (right.distanceKm ?? Number.POSITIVE_INFINITY);
      if (distance !== 0) return distance;
    }
    if (sort === "updated") {
      const freshness = new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
      if (freshness !== 0) return freshness;
    }
    if (sort === "availability") {
      const availability = availabilityRank(left.availabilityState) - availabilityRank(right.availabilityState);
      if (availability !== 0) return availability;
    }
    const availability = availabilityRank(left.availabilityState) - availabilityRank(right.availabilityState);
    if (availability !== 0) return availability;
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  };
}

function forPatient(doctor: DirectoryDoctor, patientLocationAuthorized: boolean): DirectoryDoctor {
  return patientLocationAuthorized ? doctor : { ...doctor, distanceKm: undefined };
}

export function searchDirectory(search: Pick<DerivedSearch, "filters">, sort: ResultSort, patientLocationAuthorized: boolean) {
  const matching = directoryDoctors.filter((doctor) => matches(doctor, search.filters));
  const organic = matching.filter((doctor) => !doctor.sponsored).sort(compareOrganic(sort, patientLocationAuthorized)).map((doctor) => forPatient(doctor, patientLocationAuthorized));
  const sponsored = matching.filter((doctor) => doctor.sponsored).map((doctor) => forPatient(doctor, patientLocationAuthorized));
  return { organic, sponsored };
}

export function resultPage<T>(items: T[], cursor: number, size = 2) {
  const start = cursor * size;
  const page = items.slice(start, start + size);
  return { items: page, nextCursor: start + size < items.length ? cursor + 1 : null };
}
