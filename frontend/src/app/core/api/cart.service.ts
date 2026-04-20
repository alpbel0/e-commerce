import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import type { ApiListResponse } from '../models/common.models';
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
  private readonly _itemCount = signal(0);

  readonly itemCount = this._itemCount.asReadonly();

  getMyCart(): Observable<CartResponse> {
    return this.http.get<CartResponse>(this.base).pipe(tap((cart) => this.syncCart(cart)));
  }

  addItem(body: AddCartItemRequest): Observable<CartResponse> {
    return this.http.post<CartResponse>(`${this.base}/items`, body).pipe(tap((cart) => this.syncCart(cart)));
  }

  updateItem(itemId: string, body: UpdateCartItemRequest): Observable<CartResponse> {
    return this.http.patch<CartResponse>(`${this.base}/items/${itemId}`, body).pipe(tap((cart) => this.syncCart(cart)));
  }

  removeItem(itemId: string): Observable<CartResponse> {
    return this.http.delete<CartResponse>(`${this.base}/items/${itemId}`).pipe(tap((cart) => this.syncCart(cart)));
  }

  listStoreCoupons(storeId: string): Observable<ApiListResponse<string>> {
    return this.http.get<ApiListResponse<string>>(`${this.base}/stores/${storeId}/coupons`);
  }

  applyCoupon(storeId: string, body: ApplyStoreCouponRequest): Observable<CartResponse> {
    return this.http.post<CartResponse>(`${this.base}/stores/${storeId}/coupon`, body).pipe(tap((cart) => this.syncCart(cart)));
  }

  removeCoupon(storeId: string): Observable<CartResponse> {
    return this.http.delete<CartResponse>(`${this.base}/stores/${storeId}/coupon`).pipe(tap((cart) => this.syncCart(cart)));
  }

  clearCount(): void {
    this._itemCount.set(0);
  }

  private syncCart(cart: CartResponse): void {
    this._itemCount.set(cart.totalItemCount ?? 0);
  }
}
