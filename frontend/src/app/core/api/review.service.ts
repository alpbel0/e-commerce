import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { ApiPageResponse } from '../models/common.models';
import type {
  CreateReviewRequest,
  CreateReviewResponseRequest,
  ReviewDto,
  ReviewResponseDto,
  UpdateReviewRequest
} from '../models/review.models';

export interface ReviewListParams {
  productId: string;
  page?: number;
  size?: number;
  sort?: string;
}

@Injectable({ providedIn: 'root' })
export class ReviewService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/reviews`;

  create(body: CreateReviewRequest): Observable<ReviewDto> {
    return this.http.post<ReviewDto>(this.base, body);
  }

  list(params: ReviewListParams): Observable<ApiPageResponse<ReviewDto>> {
    let h = new HttpParams().set('productId', params.productId);
    if (params.page != null) h = h.set('page', String(params.page));
    if (params.size != null) h = h.set('size', String(params.size));
    if (params.sort) h = h.set('sort', params.sort);
    return this.http.get<ApiPageResponse<ReviewDto>>(this.base, { params: h });
  }

  getById(reviewId: string): Observable<ReviewDto> {
    return this.http.get<ReviewDto>(`${this.base}/${reviewId}`);
  }

  update(reviewId: string, body: UpdateReviewRequest): Observable<ReviewDto> {
    return this.http.patch<ReviewDto>(`${this.base}/${reviewId}`, body);
  }

  delete(reviewId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${reviewId}`);
  }

  addResponse(reviewId: string, body: CreateReviewResponseRequest): Observable<ReviewResponseDto> {
    return this.http.post<ReviewResponseDto>(`${this.base}/${reviewId}/responses`, body);
  }
}
