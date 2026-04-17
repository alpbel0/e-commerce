import type { ShipmentSummaryResponse } from './shipment.models';

export type CheckoutPaymentMethod =
  | 'CREDIT_CARD'
  | 'STRIPE_CARD'
  | 'DEBIT_CARD'
  | 'PAYPAL'
  | 'WIRE_TRANSFER'
  | 'CASH_ON_DELIVERY';

export interface CheckoutRequest {
  paymentMethod: CheckoutPaymentMethod;
  shippingAddressLine1: string;
  shippingAddressLine2?: string | null;
  shippingCity: string;
  shippingState?: string | null;
  shippingPostalCode?: string | null;
  shippingCountry: string;
  customerPhone?: string | null;
  notes?: string | null;
}

export interface CheckoutOrderResponse {
  orderId: string;
  incrementId: string;
  storeId: string;
  storeName: string;
  subtotal: string;
  discountAmount: string;
  grandTotal: string;
  currency: string;
  shipmentStatus: string;
}

export interface CheckoutResponse {
  createdOrders: CheckoutOrderResponse[];
  totalOrdersCreated: number;
  grandTotal: string;
}

export interface OrderSummaryResponse {
  orderId: string;
  incrementId: string;
  customerEmail: string;
  storeId: string;
  storeName: string;
  status: string;
  paymentStatus: string;
  subtotal: string;
  discountAmount: string;
  grandTotal: string;
  currency: string;
  couponCode: string | null;
  orderDate: string;
}

export interface OrderItemResponse {
  orderItemId: string;
  productId: string;
  sku: string;
  title: string;
  quantity: number;
  unitPriceAtPurchase: string;
  discountApplied: string;
  subtotal: string;
  returnStatus: string | null;
  returnReason: string | null;
  returnUpdateNote: string | null;
  returnedQuantity: number | null;
  refundableAmount: string | null;
}

export interface OrderDetailResponse {
  orderId: string;
  incrementId: string;
  userId: string;
  customerEmail: string;
  storeId: string;
  storeName: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  subtotal: string;
  discountAmount: string;
  shippingFee: string;
  taxAmount: string;
  grandTotal: string;
  currency: string;
  couponCode: string | null;
  shippingAddressLine1: string;
  shippingAddressLine2: string | null;
  shippingCity: string;
  shippingState: string | null;
  shippingPostalCode: string | null;
  shippingCountry: string;
  customerPhone: string | null;
  notes: string | null;
  orderDate: string;
  items: OrderItemResponse[];
  shipment: ShipmentSummaryResponse | null;
}

export interface UpdateOrderStatusRequest {
  status: string;
}

export interface UpdatePaymentStatusRequest {
  paymentStatus: string;
}

export interface RequestReturnRequest {
  returnedQuantity: number;
  reason: string;
}

export interface UpdateReturnStatusRequest {
  status: string;
  note?: string | null;
}
