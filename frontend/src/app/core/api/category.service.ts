import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { ApiListResponse } from '../models/common.models';
import type { CategoryResponse } from '../models/category.models';

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/categories`;

  list(): Observable<ApiListResponse<CategoryResponse>> {
    return this.http.get<ApiListResponse<CategoryResponse>>(this.base);
  }

  getById(categoryId: string): Observable<CategoryResponse> {
    return this.http.get<CategoryResponse>(`${this.base}/${categoryId}`);
  }
}
