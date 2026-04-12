export interface ProductSummaryResponse {
  id: string;
  sku: string;
  title: string;
  unitPrice: string;
  discountPercentage: string;
  stockQuantity: number;
  avgRating: string;
  reviewCount: number;
  active: boolean;
  storeId: string;
  storeName: string;
  categoryId: string;
  categoryName: string;
}

export interface ProductDetailResponse {
  id: string;
  sku: string;
  title: string;
  description: string | null;
  brand: string | null;
  unitPrice: string;
  discountPercentage: string;
  costOfProduct: string;
  stockQuantity: number;
  avgRating: string;
  reviewCount: number;
  totalSales: number;
  active: boolean;
  storeId: string;
  storeName: string;
  categoryId: string;
  categoryName: string;
  imageUrls: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductRequest {
  storeId: string;
  categoryId: string;
  sku: string;
  title: string;
  description?: string | null;
  brand?: string | null;
  imageUrls?: string[] | null;
  unitPrice: string;
  discountPercentage?: string | null;
  costOfProduct?: string | null;
  stockQuantity: number;
  tags?: string[] | null;
}

export interface UpdateProductRequest {
  categoryId: string;
  title: string;
  description?: string | null;
  brand?: string | null;
  imageUrls?: string[] | null;
  unitPrice: string;
  discountPercentage?: string | null;
  costOfProduct?: string | null;
  stockQuantity: number;
  tags?: string[] | null;
  active?: boolean | null;
}

export interface PatchProductRequest {
  categoryId?: string | null;
  title?: string | null;
  description?: string | null;
  brand?: string | null;
  imageUrls?: string[] | null;
  unitPrice?: string | null;
  discountPercentage?: string | null;
  costOfProduct?: string | null;
  stockQuantity?: number | null;
  tags?: string[] | null;
  active?: boolean | null;
}

export interface UpdateProductStockRequest {
  stockQuantity: number;
}
