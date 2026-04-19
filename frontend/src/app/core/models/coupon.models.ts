export interface CouponResponse {
  id: string;
  storeId: string;
  storeName: string;
  code: string;
  discountPercentage: number;
  active: boolean;
  validUntil: string | null;
  createdAt: string;
}

export interface UpdateCouponRequest {
  storeId?: string;
  code?: string;
  discountPercentage?: string;
  validUntil?: string | null;
  active?: boolean;
}
