import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { ApiPageResponse } from '../models/common.models';
import type {
  CheckoutRequest,
  CheckoutResponse,
  OrderDetailResponse,
  OrderItemResponse,
  OrderSummaryResponse,
  RequestReturnRequest,
  UpdateOrderStatusRequest,
  UpdatePaymentStatusRequest,
  UpdateReturnStatusRequest
} from '../models/order.models';
import type { ShipmentSummaryResponse } from '../models/shipment.models';

export interface OrderListParams {
  page?: number;
  size?: number;
  sort?: string;
  status?: string;
  storeId?: string;
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/orders`;

  checkout(body: CheckoutRequest): Observable<CheckoutResponse> {
    return this.http.post<CheckoutResponse>(this.base, body);
  }

  list(params?: OrderListParams): Observable<ApiPageResponse<OrderSummaryResponse>> {
    let h = new HttpParams();
    if (params?.page != null) h = h.set('page', String(params.page));
    if (params?.size != null) h = h.set('size', String(params.size));
    if (params?.sort) h = h.set('sort', params.sort);
    if (params?.status) h = h.set('status', params.status);
    if (params?.storeId) h = h.set('storeId', params.storeId);
    return this.http.get<ApiPageResponse<OrderSummaryResponse>>(this.base, { params: h });
  }

  getById(orderId: string): Observable<OrderDetailResponse> {
    return this.http.get<OrderDetailResponse>(`${this.base}/${orderId}`);
  }

  updateStatus(orderId: string, body: UpdateOrderStatusRequest): Observable<OrderDetailResponse> {
    return this.http.patch<OrderDetailResponse>(`${this.base}/${orderId}/status`, body);
  }

  updatePaymentStatus(orderId: string, body: UpdatePaymentStatusRequest): Observable<OrderDetailResponse> {
    return this.http.patch<OrderDetailResponse>(`${this.base}/${orderId}/payment-status`, body);
  }

  requestReturn(orderItemId: string, body: RequestReturnRequest): Observable<OrderItemResponse> {
    return this.http.post<OrderItemResponse>(`${this.base}/items/${orderItemId}/return`, body);
  }

  updateReturnStatus(orderItemId: string, body: UpdateReturnStatusRequest): Observable<OrderItemResponse> {
    return this.http.patch<OrderItemResponse>(`${this.base}/items/${orderItemId}/return-status`, body);
  }

  getShipment(orderId: string): Observable<ShipmentSummaryResponse> {
    return this.http.get<ShipmentSummaryResponse>(`${this.base}/${orderId}/shipment`);
  }
}
