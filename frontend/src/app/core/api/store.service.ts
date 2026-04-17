import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { ApiPageResponse } from '../models/common.models';
import type { StoreDetailResponse, StoreSummaryResponse } from '../models/store.models';

export interface StoreListParams {
  page?: number;
  size?: number;
  sort?: string;
  status?: string;
}

@Injectable({ providedIn: 'root' })
export class StoreService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/stores`;

  list(params?: StoreListParams): Observable<ApiPageResponse<StoreSummaryResponse>> {
    let h = new HttpParams();
    if (params?.page != null) h = h.set('page', String(params.page));
    if (params?.size != null) h = h.set('size', String(params.size));
    if (params?.sort) h = h.set('sort', params.sort);
    if (params?.status) h = h.set('status', params.status);
    return this.http.get<ApiPageResponse<StoreSummaryResponse>>(this.base, { params: h });
  }

  getById(storeId: string): Observable<StoreDetailResponse> {
    return this.http.get<StoreDetailResponse>(`${this.base}/${storeId}`);
  }

  getBySlug(slug: string): Observable<StoreDetailResponse> {
    return this.http.get<StoreDetailResponse>(`${this.base}/slug/${slug}`);
  }

  getStoresByOwner(ownerId: string): Observable<ApiPageResponse<StoreSummaryResponse>> {
    let h = new HttpParams().set('ownerId', ownerId);
    return this.http.get<ApiPageResponse<StoreSummaryResponse>>(this.base, { params: h });
  }
}
