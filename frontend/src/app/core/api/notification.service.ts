import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { ApiPageResponse } from '../models/common.models';
import type { MarkAsReadResponse, NotificationResponse } from '../models/notification.models';

export interface NotificationListParams {
  page?: number;
  size?: number;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/notifications`;

  listMine(params?: NotificationListParams): Observable<ApiPageResponse<NotificationResponse>> {
    let h = new HttpParams();
    if (params?.page != null) h = h.set('page', String(params.page));
    if (params?.size != null) h = h.set('size', String(params.size));
    return this.http.get<ApiPageResponse<NotificationResponse>>(`${this.base}/me`, { params: h });
  }

  markRead(notificationId: string): Observable<NotificationResponse> {
    return this.http.patch<NotificationResponse>(`${this.base}/${notificationId}/read`, null);
  }

  markAllRead(): Observable<MarkAsReadResponse> {
    return this.http.patch<MarkAsReadResponse>(`${this.base}/me/read-all`, null);
  }
}
