import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { StoreDetailResponse, StoreSummaryResponse, UpdateStoreRequest } from '../models/store.models';

@Injectable({ providedIn: 'root' })
export class CorporateService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/corporate`;

  myStores(): Observable<StoreSummaryResponse[]> {
    return this.http.get<StoreSummaryResponse[]>(`${this.base}/stores`);
  }

  updateStore(storeId: string, body: UpdateStoreRequest): Observable<StoreDetailResponse> {
    return this.http.patch<StoreDetailResponse>(`${this.base}/stores/${storeId}`, body);
  }
}
