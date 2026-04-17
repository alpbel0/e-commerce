import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type {
  CreateStripePaymentIntentRequest,
  CreateStripePaymentIntentResponse,
  CreateStripeRefundRequest,
  CreateStripeRefundResponse
} from '../models/payment.models';

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/payments/stripe`;

  createStripePaymentIntent(
    body: CreateStripePaymentIntentRequest
  ): Observable<CreateStripePaymentIntentResponse> {
    return this.http.post<CreateStripePaymentIntentResponse>(`${this.base}/create-intent`, body);
  }

  createStripeRefund(body: CreateStripeRefundRequest): Observable<CreateStripeRefundResponse> {
    return this.http.post<CreateStripeRefundResponse>(`${this.base}/refunds`, body);
  }
}
