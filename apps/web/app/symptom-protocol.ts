import type { SearchFilters } from "./search";

export const reviewedUrgencyProtocol = {
  version: "2026-07",
  reviewedBy: "Responsável clínica do Medário",
  signals: ["dor no peito", "falta de ar", "desmaio", "sangramento intenso"],
} as const;

export type SymptomGuidance =
  | { kind: "urgent"; message: string; filters: SearchFilters }
  | { kind: "orientation"; message: string; filters: SearchFilters }
  | { kind: "none"; message: string; filters: SearchFilters };

export function orientSymptomSearch(query: string): SymptomGuidance {
  const normalized = query.toLocaleLowerCase("pt-BR");
  if (reviewedUrgencyProtocol.signals.some((signal) => normalized.includes(signal))) {
    return { kind: "urgent", filters: {}, message: "Este relato pode precisar de atendimento imediato. Procure um serviço de urgência ou ligue 192." };
  }
  if (/\b(ansiedade|depress[aã]o|crise)\b/i.test(query)) {
    return { kind: "orientation", filters: { specialty: "psiquiatria" }, message: "Podemos orientar sua busca para Psiquiatria. Isso não é diagnóstico nem substitui atendimento médico." };
  }
  if (/\b(febre|tosse)\b/i.test(query)) {
    return { kind: "orientation", filters: { specialty: "pediatria" }, message: "Podemos orientar sua busca para uma especialidade compatível. Isso não é diagnóstico nem substitui atendimento médico." };
  }
  return { kind: "none", filters: {}, message: "" };
}
