import type { RoleType } from './common.models';

export interface UserProfileResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  activeRole: RoleType;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresInSeconds: number;
  user: UserProfileResponse;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  role: RoleType;
  storeName?: string | null;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  message: string;
  resetToken: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface AccessScopeResponse {
  userId: string;
  email: string;
  activeRole: RoleType;
  ownedStoreIds: string[];
  ownedStoreNames: string[];
}

export interface MessageResponse {
  message: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
