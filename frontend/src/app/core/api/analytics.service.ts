import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { ApiListResponse } from '../models/common.models';
import type {
  AdminSummaryResponse,
  CorporateSummaryResponse,
  RankedProductResponse,
  RankedStoreResponse,
  StoreRevenueResponse
} from '../models/analytics.models';

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/analytics`;

  adminSummary(): Observable<AdminSummaryResponse> {
    return this.http.get<AdminSummaryResponse>(`${this.base}/admin/summary`);
  }

  adminTopProducts(limit?: number): Observable<ApiListResponse<RankedProductResponse>> {
    const params = limit != null ? new HttpParams().set('limit', String(limit)) : undefined;
    return this.http.get<ApiListResponse<RankedProductResponse>>(`${this.base}/admin/top-products`, {
      params
    });
  }

  adminTopStores(limit?: number): Observable<ApiListResponse<RankedStoreResponse>> {
    const params = limit != null ? new HttpParams().set('limit', String(limit)) : undefined;
    return this.http.get<ApiListResponse<RankedStoreResponse>>(`${this.base}/admin/top-stores`, { params });
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
