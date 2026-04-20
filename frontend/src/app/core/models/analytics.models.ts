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

export interface AnalyticsFilterOptionResponse {
  id: string;
  label: string;
}

export interface AdminAnalyticsFilterOptionsResponse {
  stores: AnalyticsFilterOptionResponse[];
  categories: AnalyticsFilterOptionResponse[];
}

export interface AnalyticsStoreComparisonResponse {
  storeId: string;
  storeName: string;
  totalOrders: number;
  totalRevenue: string;
  averageOrderValue: string;
  revenuePerProduct: string;
}

export interface AnalyticsTrendPointResponse {
  label: string;
  totalOrders: number;
  totalUnitsSold: number;
  totalRevenue: string;
}

export interface AnalyticsCategoryPerformanceResponse {
  categoryId: string;
  categoryName: string;
  totalOrders: number;
  totalUnitsSold: number;
  totalRevenue: string;
}
