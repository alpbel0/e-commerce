import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { ApiListResponse } from '../models/common.models';
import type {
  AdminAnalyticsFilterOptionsResponse,
  AdminSummaryResponse,
  AnalyticsCategoryPerformanceResponse,
  AnalyticsStoreComparisonResponse,
  AnalyticsTrendPointResponse,
  CorporateSummaryResponse,
  RankedProductResponse,
  RankedStoreResponse,
  StoreRevenueResponse
} from '../models/analytics.models';

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/analytics`;

  private buildAdminAnalyticsParams(filters?: {
    limit?: number;
    currency?: string;
    storeIds?: string[];
    categoryId?: string;
    productStatus?: string;
    stockStatus?: string;
    from?: string;
    to?: string;
  }): HttpParams | undefined {
    let params = new HttpParams();
    if (!filters) {
      return undefined;
    }
    if (filters.limit != null) params = params.set('limit', String(filters.limit));
    if (filters.currency) params = params.set('currency', filters.currency);
    for (const storeId of filters.storeIds ?? []) {
      if (storeId) params = params.append('storeIds', storeId);
    }
    if (filters.categoryId) params = params.set('categoryId', filters.categoryId);
    if (filters.productStatus) params = params.set('productStatus', filters.productStatus);
    if (filters.stockStatus) params = params.set('stockStatus', filters.stockStatus);
    if (filters.from) params = params.set('from', filters.from);
    if (filters.to) params = params.set('to', filters.to);
    return params.keys().length > 0 ? params : undefined;
  }

  adminSummary(currency?: string): Observable<AdminSummaryResponse> {
    const params = currency ? new HttpParams().set('currency', currency) : undefined;
    return this.http.get<AdminSummaryResponse>(`${this.base}/admin/summary`, { params });
  }

  adminFilterOptions(): Observable<AdminAnalyticsFilterOptionsResponse> {
    return this.http.get<AdminAnalyticsFilterOptionsResponse>(`${this.base}/admin/filter-options`);
  }

  adminTopProducts(filters?: {
    limit?: number;
    currency?: string;
    storeIds?: string[];
    categoryId?: string;
    productStatus?: string;
    stockStatus?: string;
    from?: string;
    to?: string;
  }): Observable<ApiListResponse<RankedProductResponse>> {
    return this.http.get<ApiListResponse<RankedProductResponse>>(`${this.base}/admin/top-products`, {
      params: this.buildAdminAnalyticsParams(filters)
    });
  }

  adminTopStores(limit?: number, currency?: string): Observable<ApiListResponse<RankedStoreResponse>> {
    let params = new HttpParams();
    if (limit != null) params = params.set('limit', String(limit));
    if (currency) params = params.set('currency', currency);
    return this.http.get<ApiListResponse<RankedStoreResponse>>(`${this.base}/admin/top-stores`, {
      params: params.keys().length > 0 ? params : undefined
    });
  }

  adminStoreComparison(filters?: {
    limit?: number;
    currency?: string;
    storeIds?: string[];
    categoryId?: string;
    productStatus?: string;
    stockStatus?: string;
    from?: string;
    to?: string;
  }): Observable<ApiListResponse<AnalyticsStoreComparisonResponse>> {
    return this.http.get<ApiListResponse<AnalyticsStoreComparisonResponse>>(`${this.base}/admin/store-comparison`, {
      params: this.buildAdminAnalyticsParams(filters)
    });
  }

  adminTrends(filters?: {
    currency?: string;
    storeIds?: string[];
    categoryId?: string;
    productStatus?: string;
    stockStatus?: string;
    from?: string;
    to?: string;
  }): Observable<ApiListResponse<AnalyticsTrendPointResponse>> {
    return this.http.get<ApiListResponse<AnalyticsTrendPointResponse>>(`${this.base}/admin/trends`, {
      params: this.buildAdminAnalyticsParams(filters)
    });
  }

  adminCategoryPerformance(filters?: {
    limit?: number;
    currency?: string;
    storeIds?: string[];
    categoryId?: string;
    productStatus?: string;
    stockStatus?: string;
    from?: string;
    to?: string;
  }): Observable<ApiListResponse<AnalyticsCategoryPerformanceResponse>> {
    return this.http.get<ApiListResponse<AnalyticsCategoryPerformanceResponse>>(
      `${this.base}/admin/category-performance`,
      { params: this.buildAdminAnalyticsParams(filters) }
    );
  }

  corporateSummary(storeId?: string): Observable<CorporateSummaryResponse> {
    const params = storeId ? new HttpParams().set('storeId', storeId) : undefined;
    return this.http.get<CorporateSummaryResponse>(`${this.base}/corporate/summary`, { params });
  }

  corporateTopProducts(storeId?: string, limit?: number): Observable<ApiListResponse<RankedProductResponse>> {
    let p = new HttpParams();
    if (storeId) p = p.set('storeId', storeId);
    if (limit != null) p = p.set('limit', String(limit));
    return this.http.get<ApiListResponse<RankedProductResponse>>(`${this.base}/corporate/top-products`, {
      params: p
    });
  }

  corporateRevenueByStore(storeId?: string): Observable<ApiListResponse<StoreRevenueResponse>> {
    const params = storeId ? new HttpParams().set('storeId', storeId) : undefined;
    return this.http.get<ApiListResponse<StoreRevenueResponse>>(`${this.base}/corporate/revenue-by-store`, {
      params
    });
  }
}
