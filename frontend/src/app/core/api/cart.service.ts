import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { ApiListResponse } from '../models/common.models';
import type { CouponResponse } from '../models/coupon.models';
import type {
  AddCartItemRequest,
  ApplyStoreCouponRequest,
  CartResponse,
  UpdateCartItemRequest
} from '../models/cart.models';

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/carts/me`;

  getMyCart(): Observable<CartResponse> {
    return this.http.get<CartResponse>(this.base);
  }

  addItem(body: AddCartItemRequest): Observable<CartResponse> {
    return this.http.post<CartResponse>(`${this.base}/items`, body);
  }

  updateItem(itemId: string, body: UpdateCartItemRequest): Observable<CartResponse> {
    return this.http.patch<CartResponse>(`${this.base}/items/${itemId}`, body);
  }

  removeItem(itemId: string): Observable<CartResponse> {
    return this.http.delete<CartResponse>(`${this.base}/items/${itemId}`);
  }

  listStoreCoupons(storeId: string): Observable<ApiListResponse<CouponResponse>> {
    return this.http.get<ApiListResponse<CouponResponse>>(`${this.base}/stores/${storeId}/coupons`);
  }

  applyCoupon(storeId: string, body: ApplyStoreCouponRequest): Observable<CartResponse> {
    return this.http.post<CartResponse>(`${this.base}/stores/${storeId}/coupon`, body);
  }

  removeCoupon(storeId: string): Observable<CartResponse> {
    return this.http.delete<CartResponse>(`${this.base}/stores/${storeId}/coupon`);
  }
}
