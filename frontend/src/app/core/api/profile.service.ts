import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { ProfileResponse, UpdateProfileRequest } from '../models/profile.models';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/profiles`;

  getMe(): Observable<ProfileResponse> {
    return this.http.get<ProfileResponse>(`${this.base}/me`);
  }

  patchMe(body: UpdateProfileRequest): Observable<ProfileResponse> {
    return this.http.patch<ProfileResponse>(`${this.base}/me`, body);
  }
}
