import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { ProductSummaryResponse } from '../models/product.models';

@Injectable({ providedIn: 'root' })
export class HomeService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/products`;

  getFeatured(limit = 8): Observable<ProductSummaryResponse[]> {
    return this.http.get<ProductSummaryResponse[]>(`${this.base}/featured`, {
      params: { limit: String(limit) }
    });
  }
}
