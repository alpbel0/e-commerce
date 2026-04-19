import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { CouponResponse, UpdateCouponRequest } from '../models/coupon.models';
import type { ApiPageResponse } from '../models/common.models';
import type {
  CreateStoreRequest,
  StoreDetailResponse,
  StoreSummaryResponse,
  UpdateStoreRequest
} from '../models/store.models';

export interface CreateCouponRequest {
  code: string;
  discountPercentage: string;
  validUntil?: string;
  storeId?: string;
  active?: boolean;
}

@Injectable({ providedIn: 'root' })
export class CorporateService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/corporate`;
  private readonly couponBase = `${environment.apiBaseUrl}/coupons`;

  myStores(): Observable<StoreSummaryResponse[]> {
    return this.http.get<StoreSummaryResponse[]>(`${this.base}/stores`);
  }

  createStore(body: CreateStoreRequest): Observable<StoreDetailResponse> {
    return this.http.post<StoreDetailResponse>(`${this.base}/stores`, body);
  }

  updateStore(storeId: string, body: UpdateStoreRequest): Observable<StoreDetailResponse> {
    return this.http.patch<StoreDetailResponse>(`${this.base}/stores/${storeId}`, body);
  }

  getCoupons(storeId?: string): Observable<ApiPageResponse<CouponResponse>> {
    let params = new HttpParams();
    if (storeId) params = params.set('storeId', storeId);
    return this.http.get<ApiPageResponse<CouponResponse>>(this.couponBase, { params });
  }

  getCoupon(couponId: string): Observable<CouponResponse> {
    return this.http.get<CouponResponse>(`${this.couponBase}/${couponId}`);
  }

  createCoupon(body: CreateCouponRequest): Observable<CouponResponse> {
    return this.http.post<CouponResponse>(this.couponBase, body);
  }

  updateCoupon(couponId: string, body: UpdateCouponRequest): Observable<CouponResponse> {
    return this.http.patch<CouponResponse>(`${this.couponBase}/${couponId}`, body);
  }

  deleteCoupon(couponId: string): Observable<void> {
    return this.http.delete<void>(`${this.couponBase}/${couponId}`);
  }
}
