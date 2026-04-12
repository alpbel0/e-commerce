export type RoleType = 'ADMIN' | 'CORPORATE' | 'INDIVIDUAL';

export interface FieldValidationError {
  field: string;
  message: string;
}

export interface ApiErrorResponse {
  timestamp?: string;
  status: number;
  error: string;
  message: string;
  path: string;
  fieldErrors?: FieldValidationError[];
}

export interface ApiPageResponse<T> {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface ApiListResponse<T> {
  items: T[];
  count: number;
}
