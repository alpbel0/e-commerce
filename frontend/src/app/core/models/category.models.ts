export interface CategoryResponse {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  level: number;
  active: boolean;
  displayOrder: number;
}
