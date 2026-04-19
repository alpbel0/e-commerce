import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  ChatAskRequest,
  ChatAskResponse,
  ChatSessionStateResponse,
  ErrorCode,
} from '../models/chat.models';

function httpErrorToUserMessage(err: HttpErrorResponse): string {
  if (err.status === 401 || err.status === 403) {
    return 'Oturumunuz sona ermiş veya bu işlem için yetkiniz yok. Lütfen tekrar giriş yapın.';
  }
  if (err.status === 0) {
    return 'Ağ hatası: sunucuya ulaşılamadı. Bağlantınızı kontrol edin.';
  }
  if (err.status >= 502 && err.status <= 504) {
    return 'Sunucu veya analytics servisi geçici olarak yanıt vermiyor. Lütfen bir süre sonra tekrar deneyin.';
  }
  return 'Beklenmeyen bir hata oluştu. Lütfen daha sonra tekrar deneyin.';
}

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiBaseUrl}/chat`;

  getActiveSession(): Observable<ChatSessionStateResponse> {
    return this.http.get<ChatSessionStateResponse>(`${this.apiUrl}/session/active`);
  }

  createNewSession(): Observable<ChatSessionStateResponse> {
    return this.http.post<ChatSessionStateResponse>(`${this.apiUrl}/session/new`, {});
  }

  askQuestion(request: ChatAskRequest): Observable<ChatAskResponse> {
    return this.http.post<ChatAskResponse>(`${this.apiUrl}/ask`, request).pipe(
      catchError((err: HttpErrorResponse): Observable<ChatAskResponse> =>
        of({
          requestId: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : '',
          executionSteps: [],
          error: {
            code: 'BACKEND_UNAVAILABLE' as ErrorCode,
            message: httpErrorToUserMessage(err),
          },
        })
      )
    );
  }
}
