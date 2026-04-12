export interface NotificationResponse {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  readAt: string | null;
  createdAt: string;
  orderId: string | null;
  orderIncrementId: string | null;
}

export interface MarkAsReadResponse {
  updatedCount: number;
}
