import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type {
  AccessScopeResponse,
  AuthResponse,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  LoginRequest,
  MessageResponse,
  RefreshTokenRequest,
  RegisterRequest,
  ResetPasswordRequest,
  UserProfileResponse
} from '../models/auth.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/auth`;

  login(body: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/login`, body);
  }

  register(body: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/register`, body);
  }

  refresh(body: RefreshTokenRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/refresh`, body);
  }

  me(): Observable<UserProfileResponse> {
    return this.http.get<UserProfileResponse>(`${this.base}/me`);
  }

  scope(): Observable<AccessScopeResponse> {
    return this.http.get<AccessScopeResponse>(`${this.base}/me/scope`);
  }

  forgotPassword(body: ForgotPasswordRequest): Observable<ForgotPasswordResponse> {
    return this.http.post<ForgotPasswordResponse>(`${this.base}/forgot-password`, body);
  }

  resetPassword(body: ResetPasswordRequest): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.base}/reset-password`, body);
  }

  changePassword(body: ChangePasswordRequest): Observable<MessageResponse> {
    return this.http.put<MessageResponse>(`${this.base}/me/change-password`, body);
  }
}
