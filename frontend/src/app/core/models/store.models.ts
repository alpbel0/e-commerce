export interface StoreSummaryResponse {
  id: string;
  name: string;
  contactEmail: string;
  status: string;
  productCount: number | null;
  ownerEmail: string | null;
  slug?: string | null;
}

export interface StoreDetailResponse {
  id: string;
  name: string;
  description: string | null;
  contactEmail: string;
  contactPhone: string | null;
  address: string | null;
  totalSales: string;
  productCount: number | null;
  rating: string | null;
  status: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateStoreRequest {
  name?: string | null;
  description?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  status?: string | null;
}

export interface CreateStoreRequest {
  name: string;
  description?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
}

export interface UpdateStoreStatusRequest {
  status: string;
}
