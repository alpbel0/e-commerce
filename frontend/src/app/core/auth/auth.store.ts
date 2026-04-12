import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, shareReplay, switchMap, tap, throwError } from 'rxjs';

import { AuthService } from '../api/auth.service';
import type { AuthResponse, RegisterRequest, UserProfileResponse } from '../models/auth.models';
import type { RoleType } from '../models/common.models';

const LS_ACCESS = 'access_token';
const LS_REFRESH = 'refresh_token';

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly authService = inject(AuthService);

  private readonly _accessToken = signal<string | null>(localStorage.getItem(LS_ACCESS));
  private readonly _refreshToken = signal<string | null>(localStorage.getItem(LS_REFRESH));
  private readonly _currentUser = signal<UserProfileResponse | null>(null);
  private readonly _activeRole = signal<RoleType | null>(null);
  private readonly _ownedStoreIds = signal<string[]>([]);
  private readonly _ownedStoreNames = signal<string[]>([]);

  private refreshInFlight$: Observable<string> | null = null;

  readonly accessToken = this._accessToken.asReadonly();
  readonly refreshToken = this._refreshToken.asReadonly();
  readonly currentUser = this._currentUser.asReadonly();
  readonly activeRole = this._activeRole.asReadonly();
  readonly ownedStoreIds = this._ownedStoreIds.asReadonly();
  readonly ownedStoreNames = this._ownedStoreNames.asReadonly();

  readonly isLoggedIn = computed(() => !!this._accessToken());
  readonly isAdmin = computed(() => this._activeRole() === 'ADMIN');
  readonly isCorporate = computed(() => this._activeRole() === 'CORPORATE');
  readonly isIndividual = computed(() => this._activeRole() === 'INDIVIDUAL');

  constructor() {
    queueMicrotask(() => this.tryRestoreProfile());
  }

  private tryRestoreProfile(): void {
    if (!this._accessToken()) {
      return;
    }
    this.authService.me().pipe(
      tap((u) => {
        this._currentUser.set(u);
        this._activeRole.set(u.activeRole);
      }),
      switchMap(() =>
        this.loadScope().pipe(
          catchError(() => {
            this._ownedStoreIds.set([]);
            this._ownedStoreNames.set([]);
            return of(undefined);
          })
        )
      )
    ).subscribe({
      next: () => {},
      error: () => {}
    });
  }

  applyAuthResponse(res: AuthResponse): void {
    localStorage.setItem(LS_ACCESS, res.accessToken);
    localStorage.setItem(LS_REFRESH, res.refreshToken);
    this._accessToken.set(res.accessToken);
    this._refreshToken.set(res.refreshToken);
    this._currentUser.set(res.user);
    this._activeRole.set(res.user.activeRole);
  }

  login(email: string, password: string): Observable<void> {
    return this.authService.login({ email, password }).pipe(
      tap((res) => this.applyAuthResponse(res)),
      switchMap(() => this.loadScope())
    );
  }

  register(request: RegisterRequest): Observable<void> {
    return this.authService.register(request).pipe(map(() => undefined));
  }

  logout(): void {
    localStorage.removeItem(LS_ACCESS);
    localStorage.removeItem(LS_REFRESH);
    this._accessToken.set(null);
    this._refreshToken.set(null);
    this._currentUser.set(null);
    this._activeRole.set(null);
    this._ownedStoreIds.set([]);
    this._ownedStoreNames.set([]);
  }

  refreshAccessToken(): Observable<string> {
    const rt = this._refreshToken() ?? localStorage.getItem(LS_REFRESH);
    if (!rt) {
      return throwError(() => new Error('No refresh token'));
    }
    if (!this.refreshInFlight$) {
      this.refreshInFlight$ = this.authService.refresh({ refreshToken: rt }).pipe(
        tap((res) => this.applyAuthResponse(res)),
        switchMap((res) =>
          this.loadScope().pipe(
            map(() => res.accessToken),
            catchError(() => of(res.accessToken))
          )
        ),
        finalize(() => {
          this.refreshInFlight$ = null;
        }),
        shareReplay({ bufferSize: 1, refCount: true })
      );
    }
    return this.refreshInFlight$;
  }

  loadScope(): Observable<void> {
    return this.authService.scope().pipe(
      tap((s) => {
        this._ownedStoreIds.set(s.ownedStoreIds ?? []);
        this._ownedStoreNames.set(s.ownedStoreNames ?? []);
      }),
      map(() => undefined)
    );
  }

  /** Token varken profil henüz yüklenmediyse (ör. guestGuard) /me ile doldurur */
  ensureProfileLoaded(): Observable<void> {
    if (this._currentUser() && this._activeRole()) {
      return of(undefined);
    }
    if (!this._accessToken()) {
      return of(undefined);
    }
    return this.authService.me().pipe(
      tap((u) => {
        this._currentUser.set(u);
        this._activeRole.set(u.activeRole);
      }),
      switchMap(() =>
        this.loadScope().pipe(
          catchError(() => {
            this._ownedStoreIds.set([]);
            this._ownedStoreNames.set([]);
            return of(undefined);
          })
        )
      ),
      map(() => undefined)
    );
  }
}
