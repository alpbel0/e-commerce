export interface ReviewResponseDto {
  id: string;
  responderUserId: string;
  responderEmail: string;
  responseText: string;
  createdAt: string;
}

export interface ReviewDto {
  id: string;
  userId: string;
  userEmail: string;
  productId: string;
  orderId: string;
  starRating: number;
  reviewTitle: string;
  reviewText: string;
  reviewImages: string[];
  verifiedPurchase: boolean;
  createdAt: string;
  updatedAt: string;
  responses: ReviewResponseDto[];
}

export interface CreateReviewRequest {
  orderId: string;
  productId: string;
  starRating: number;
  reviewTitle: string;
  reviewText: string;
  reviewImages?: string[] | null;
}

export interface UpdateReviewRequest {
  starRating: number;
  reviewTitle: string;
  reviewText: string;
  reviewImages?: string[] | null;
}

export interface CreateReviewResponseRequest {
  responseText: string;
}
