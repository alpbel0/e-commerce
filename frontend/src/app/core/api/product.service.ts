import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { ApiPageResponse } from '../models/common.models';
import type {
  AddProductImagesRequest,
  CreateProductRequest,
  PatchProductRequest,
  ProductDetailResponse,
  ProductSummaryResponse,
  UpdateProductRequest,
  UpdateProductStockRequest
} from '../models/product.models';

export interface ProductListParams {
  page?: number;
  size?: number;
  sort?: string;
  categoryId?: string;
  storeId?: string;
  q?: string;
  active?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/products`;

  list(params?: ProductListParams): Observable<ApiPageResponse<ProductSummaryResponse>> {
    return this.http.get<ApiPageResponse<ProductSummaryResponse>>(this.base, {
      params: this.toParams(params)
    });
  }

  getById(productId: string): Observable<ProductDetailResponse> {
    return this.http.get<ProductDetailResponse>(`${this.base}/${productId}`);
  }

  create(body: CreateProductRequest): Observable<ProductDetailResponse> {
    return this.http.post<ProductDetailResponse>(this.base, body);
  }

  update(productId: string, body: UpdateProductRequest): Observable<ProductDetailResponse> {
    return this.http.put<ProductDetailResponse>(`${this.base}/${productId}`, body);
  }

  patch(productId: string, body: PatchProductRequest): Observable<ProductDetailResponse> {
    return this.http.patch<ProductDetailResponse>(`${this.base}/${productId}`, body);
  }

  updateStock(productId: string, body: UpdateProductStockRequest): Observable<ProductDetailResponse> {
    return this.http.patch<ProductDetailResponse>(`${this.base}/${productId}/stock`, body);
  }

  delete(productId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${productId}`);
  }

  addImages(productId: string, body: AddProductImagesRequest): Observable<ProductDetailResponse> {
    return this.http.post<ProductDetailResponse>(`${this.base}/${productId}/images`, body);
  }

  private toParams(p?: ProductListParams): HttpParams {
    let h = new HttpParams();
    if (!p) return h;
    if (p.page != null) h = h.set('page', String(p.page));
    if (p.size != null) h = h.set('size', String(p.size));
    if (p.sort) h = h.set('sort', p.sort);
    if (p.categoryId) h = h.set('categoryId', p.categoryId);
    if (p.storeId) h = h.set('storeId', p.storeId);
    if (p.q) h = h.set('q', p.q);
    if (p.active != null) h = h.set('active', String(p.active));
    return h;
  }
}
