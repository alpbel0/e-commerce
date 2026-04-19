import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { ApiPageResponse } from '../models/common.models';
import type {
  AdminUserListResponse,
  AuditLogResponse,
  CreateAdminUserRequest,
  CreateCategoryRequest,
  DeleteUserResponse,
  UpdateCategoryRequest,
  UpdateUserRoleRequest,
  UpdateUserStatusRequest
} from '../models/admin.models';
import type { RoleType } from '../models/common.models';
import type { CategoryResponse } from '../models/category.models';
import type { StoreDetailResponse, StoreSummaryResponse, UpdateStoreStatusRequest } from '../models/store.models';

export interface AdminUserListQuery {
  q?: string;
  role?: RoleType;
  active?: boolean;
  page?: number;
  size?: number;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly usersBase = `${environment.apiBaseUrl}/admin/users`;
  private readonly storesBase = `${environment.apiBaseUrl}/admin/stores`;
  private readonly categoriesBase = `${environment.apiBaseUrl}/admin/categories`;
  private readonly auditBase = `${environment.apiBaseUrl}/admin/audit-logs`;

  createUser(body: CreateAdminUserRequest): Observable<AdminUserListResponse> {
    return this.http.post<AdminUserListResponse>(this.usersBase, body);
  }

  deleteUser(userId: string): Observable<DeleteUserResponse> {
    return this.http.delete<DeleteUserResponse>(`${this.usersBase}/${userId}`);
  }

  listUsers(query?: AdminUserListQuery): Observable<ApiPageResponse<AdminUserListResponse>> {
    let h = new HttpParams();
    if (query?.q) h = h.set('q', query.q);
    if (query?.role) h = h.set('role', query.role);
    if (query?.active != null) h = h.set('active', String(query.active));
    if (query?.page != null) h = h.set('page', String(query.page));
    if (query?.size != null) h = h.set('size', String(query.size));
    return this.http.get<ApiPageResponse<AdminUserListResponse>>(this.usersBase, { params: h });
  }

  updateUserStatus(userId: string, body: UpdateUserStatusRequest): Observable<AdminUserListResponse> {
    return this.http.patch<AdminUserListResponse>(`${this.usersBase}/${userId}/status`, body);
  }

  updateUserRole(userId: string, body: UpdateUserRoleRequest): Observable<AdminUserListResponse> {
    return this.http.patch<AdminUserListResponse>(`${this.usersBase}/${userId}/role`, body);
  }

  updateStoreStatus(storeId: string, body: UpdateStoreStatusRequest): Observable<StoreDetailResponse> {
    return this.http.patch<StoreDetailResponse>(`${this.storesBase}/${storeId}/status`, body);
  }

  approveStore(storeId: string): Observable<StoreDetailResponse> {
    return this.http.patch<StoreDetailResponse>(`${this.storesBase}/${storeId}/status`, { status: 'OPEN' });
  }

  rejectStore(storeId: string): Observable<StoreDetailResponse> {
    return this.http.patch<StoreDetailResponse>(`${this.storesBase}/${storeId}/status`, { status: 'SUSPENDED' });
  }

  listStores(params?: { page?: number; size?: number; status?: string }): Observable<ApiPageResponse<StoreSummaryResponse>> {
    let h = new HttpParams();
    if (params?.page != null) h = h.set('page', String(params.page));
    if (params?.size != null) h = h.set('size', String(params.size));
    if (params?.status) h = h.set('status', params.status);
    return this.http.get<ApiPageResponse<StoreSummaryResponse>>(this.storesBase, { params: h });
  }

  getAllStores(): Observable<ApiPageResponse<StoreSummaryResponse>> {
    return this.listStores({ size: 100 });
  }

  getStore(storeId: string): Observable<StoreDetailResponse> {
    return this.http.get<StoreDetailResponse>(`${this.storesBase}/${storeId}`);
  }

  createCategory(body: CreateCategoryRequest): Observable<CategoryResponse> {
    return this.http.post<CategoryResponse>(this.categoriesBase, body);
  }

  updateCategory(categoryId: string, body: UpdateCategoryRequest): Observable<CategoryResponse> {
    return this.http.patch<CategoryResponse>(`${this.categoriesBase}/${categoryId}`, body);
  }

  deleteCategory(categoryId: string): Observable<void> {
    return this.http.delete<void>(`${this.categoriesBase}/${categoryId}`);
  }

  listAuditLogs(query?: { page?: number; size?: number; action?: string }): Observable<ApiPageResponse<AuditLogResponse>> {
    let h = new HttpParams();
    if (query?.page != null) h = h.set('page', String(query.page));
    if (query?.size != null) h = h.set('size', String(query.size));
    if (query?.action) h = h.set('action', query.action);
    return this.http.get<ApiPageResponse<AuditLogResponse>>(this.auditBase, { params: h });
  }
}
