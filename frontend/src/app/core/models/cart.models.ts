export interface CartCouponResponse {
  couponId: string;
  code: string;
  discountPercentage: string;
}

export interface CartItemResponse {
  itemId: string;
  productId: string;
  sku: string;
  title: string;
  quantity: number;
  unitPrice: string;
  lineSubtotal: string;
  categoryId: string;
  categoryName: string;
}

export interface StoreCartResponse {
  storeId: string;
  storeName: string;
  totalItemCount: number;
  subtotal: string;
  discountApplied: string;
  grandTotal: string;
  activeCoupon: CartCouponResponse | null;
  items: CartItemResponse[];
}

export interface CartResponse {
  cartId: string;
  totalItemCount: number;
  subtotal: string;
  discountApplied: string;
  grandTotal: string;
  stores: StoreCartResponse[];
  updatedAt: string;
}

export interface AddCartItemRequest {
  productId: string;
  quantity: number;
}

export interface UpdateCartItemRequest {
  quantity: number;
}

export interface ApplyStoreCouponRequest {
  code: string;
}
