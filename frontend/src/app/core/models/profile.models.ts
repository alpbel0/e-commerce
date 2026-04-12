import type { RoleType } from './common.models';

export interface ProfileResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  address: string | null;
  profileImageUrl: string | null;
  activeRole: RoleType;
  active: boolean;
}

export interface UpdateProfileRequest {
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  address?: string | null;
  profileImageUrl?: string | null;
}
