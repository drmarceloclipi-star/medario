export type PublicProfile = {
  slug: string;
  name: string;
  specialty: string;
  crm: string;
  rqe?: string;
  bio: string;
  verified: boolean;
  claimed: boolean;
  updatedAt: string;
  pendingChange?: string;
  location: {
    name: string;
    address: string;
    district: string;
    city: string;
    state: string;
    authorized: boolean;
  };
  mapLocation?: {
    latitude: number;
    longitude: number;
    authorized: boolean;
  };
  insurances: Array<{ name: string; confirmed: boolean }>;
  modalities: Array<"Presencial" | "Teleconsulta externa">;
  availability: string;
  contacts: {
    whatsApp: { verified: boolean; href: string };
    phone: { verified: boolean; href: string };
  };
};

export type DirectoryQuery = {
  city?: string;
  specialty?: string;
  insurance?: string;
  modality?: "in_person" | "telemedicine";
  cursor?: string;
  limit?: number;
};

export type DirectoryPage = {
  profiles: PublicProfile[];
  hasMore: boolean;
  nextCursor?: string;
};

export interface PublicDirectoryReader {
  getBySlug(slug: string): Promise<PublicProfile | null>;
  list(query: DirectoryQuery): Promise<DirectoryPage>;
}
