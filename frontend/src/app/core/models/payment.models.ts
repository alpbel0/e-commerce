export interface CreateStripePaymentIntentRequest {
  orderId: string;
}

export interface CreateStripePaymentIntentResponse {
  paymentId: string;
  orderId: string;
  clientSecret: string;
  amount: string;
  currency: string;
  status: string;
}

export interface CreateStripeRefundRequest {
  orderItemId: string;
  reason?: string | null;
}

export interface CreateStripeRefundResponse {
  refundId: string;
  paymentId: string;
  orderItemId: string;
  providerRefundId: string;
  amount: string;
  status: string;
}
