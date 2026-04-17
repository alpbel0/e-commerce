import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { CurrencyRateResponse } from '../models/currency-rate.models';

@Injectable({ providedIn: 'root' })
export class CurrencyRateService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/currency-rates`;

  listRates(): Observable<CurrencyRateResponse[]> {
    return this.http.get<CurrencyRateResponse[]>(this.base);
  }
}
