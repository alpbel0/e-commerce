import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { WishlistItemResponse } from '../models/wishlist.models';

@Injectable({ providedIn: 'root' })
export class WishlistService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/wishlist`;

  getWishlist(): Observable<WishlistItemResponse[]> {
    return this.http.get<WishlistItemResponse[]>(this.base);
  }

  addToWishlist(productId: string, quantity?: number): Observable<WishlistItemResponse> {
    const body = quantity ? { productId, quantity } : { productId };
    return this.http.post<WishlistItemResponse>(this.base, body);
  }

  updateQuantity(productId: string, quantity: number): Observable<WishlistItemResponse> {
    return this.http.patch<WishlistItemResponse>(`${this.base}/${productId}`, { quantity });
  }

  removeFromWishlist(productId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${productId}`);
  }
}
