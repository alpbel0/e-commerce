import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { ShipmentSummaryResponse, UpdateShipmentRequest } from '../models/shipment.models';

@Injectable({ providedIn: 'root' })
export class ShipmentService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/shipments`;

  getById(shipmentId: string): Observable<ShipmentSummaryResponse> {
    return this.http.get<ShipmentSummaryResponse>(`${this.base}/${shipmentId}`);
  }

  update(shipmentId: string, body: UpdateShipmentRequest): Observable<ShipmentSummaryResponse> {
    return this.http.patch<ShipmentSummaryResponse>(`${this.base}/${shipmentId}`, body);
  }
}
