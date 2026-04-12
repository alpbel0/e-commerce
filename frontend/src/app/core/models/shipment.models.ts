export interface ShipmentSummaryResponse {
  shipmentId: string;
  orderId: string;
  trackingNumber: string | null;
  status: string;
  carrierName: string | null;
  modeOfShipment: string | null;
  estimatedDeliveryDate: string | null;
  actualDeliveryDate: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

export interface UpdateShipmentRequest {
  status: string;
  trackingNumber?: string | null;
  carrierName?: string | null;
  modeOfShipment?: string | null;
  estimatedDeliveryDate?: string | null;
  actualDeliveryDate?: string | null;
}
