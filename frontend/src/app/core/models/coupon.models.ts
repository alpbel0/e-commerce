export interface CouponResponse {
  id: string;
  storeId: string;
  storeName: string;
  code: string;
  discountPercentage: string;
  active: boolean;
  validUntil: string | null;
  createdAt: string;
}
