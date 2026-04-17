export interface WishlistItemResponse {
  id: string;
  title: string;
  imageUrl: string | null;
  currency: string;
  unitPrice: string;
  quantity: number;
  storeName: string;
  categoryName: string;
  discountPercentage: string;
  avgRating: string;
  reviewCount: number;
  active: boolean;
}

export interface AddToWishlistRequest {
  productId: string;
  quantity?: number;
}

export interface UpdateWishlistQuantityRequest {
  quantity: number;
}
