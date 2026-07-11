export const comparisonCriteria = ["insurance", "availability", "modality", "updated", "distance"] as const;
export type ComparisonCriterion = (typeof comparisonCriteria)[number];

type ComparableDoctor = { id: string; insurances: string[]; availability: string; modalities: string[]; updatedAt: string; distanceKm?: number };

export function canAddToComparison(selected: string[], doctorId: string) {
  return selected.includes(doctorId) || selected.length < 3;
}

export function buildComparison(doctors: ComparableDoctor[], criteria: ComparisonCriterion[]) {
  return doctors.map((doctor) => {
    const matchedCriteria = criteria.filter((criterion) => {
      if (criterion === "insurance") return doctor.insurances.length > 0;
      if (criterion === "availability") return doctor.availability !== "to_confirm";
      if (criterion === "modality") return doctor.modalities.length > 0;
      if (criterion === "updated") return Boolean(doctor.updatedAt);
      return doctor.distanceKm !== undefined;
    });
    return { id: doctor.id, matchedCriteria, explanation: criteria.length ? `Compatível com ${matchedCriteria.length} de ${criteria.length} critérios escolhidos.` : "Escolha critérios para ver compatibilidade." };
  });
}
