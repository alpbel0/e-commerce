export interface AdminSummaryResponse {
  totalRevenue: string;
  totalOrders: number;
  totalCustomers: number;
  totalStores: number;
  totalProducts: number;
}

export interface CorporateSummaryResponse {
  totalRevenue: string;
  totalOrders: number;
  totalProducts: number;
  averageOrderValue: string;
  totalReviews: number;
}

export interface RankedProductResponse {
  productId: string;
  productTitle: string;
  storeId: string;
  storeName: string;
  totalQuantitySold: number;
  totalRevenue: string;
}

export interface RankedStoreResponse {
  storeId: string;
  storeName: string;
  totalOrders: number;
  totalRevenue: string;
}

export interface StoreRevenueResponse {
  storeId: string;
  storeName: string;
  totalOrders: number;
  totalRevenue: string;
}
