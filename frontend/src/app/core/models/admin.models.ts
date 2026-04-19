import type { RoleType } from './common.models';

export interface AdminUserListResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  activeRole: RoleType;
  active: boolean;
}

export interface UpdateUserStatusRequest {
  active: boolean;
}

export interface UpdateUserRoleRequest {
  role: RoleType;
}

export interface CreateAdminUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  role: RoleType;
  storeName?: string | null;
  active?: boolean | null;
}

export interface DeleteUserResponse {
  userId: string;
  active: boolean;
  message: string;
}

export interface CreateCategoryRequest {
  name: string;
  description?: string | null;
  displayOrder?: number | null;
  parentId?: string | null;
  active: boolean;
}

export interface UpdateCategoryRequest {
  name?: string | null;
  description?: string | null;
  displayOrder?: number | null;
  active?: boolean | null;
}

export interface AuditLogResponse {
  id: string;
  userId: string | null;
  actorUserId: string | null;
  actorUserEmail: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  details: string;
  createdAt: string;
}
