import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { OrderService } from '../../../../core/api/order.service';
import type { OrderDetailResponse, OrderItemResponse } from '../../../../core/models/order.models';
import { ToastService } from '../../../../core/notify/toast.service';
import { ErrorStateComponent } from '../../../../shared/components/error-state/error-state.component';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { formatMoney } from '../../../../shared/util/money';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [RouterLink, LoadingSpinnerComponent, ErrorStateComponent],
  templateUrl: './order-detail.component.html',
  styles: [
    `
      .back {
        display: inline-block;
        margin-bottom: 1rem;
        color: #2563eb;
        text-decoration: none;
      }
      h2 {
        margin: 0 0 0.5rem;
      }
      .meta {
        color: #64748b;
        font-size: 0.9rem;
        margin-bottom: 1rem;
      }
      .badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 999px;
        font-size: 0.72rem;
        font-weight: 600;
        text-transform: uppercase;
        margin-right: 6px;
      }
      .st-PENDING {
        background: #fef9c3;
        color: #854d0e;
      }
      .st-PROCESSING {
        background: #ffedd5;
        color: #9a3412;
      }
      .st-SHIPPED {
        background: #fed7aa;
        color: #c2410c;
      }
      .st-DELIVERED {
        background: #dcfce7;
        color: #166534;
      }
      .st-CANCELLED {
        background: #fee2e2;
        color: #991b1b;
      }
      .rb-REQUESTED {
        background: #fef9c3;
        color: #854d0e;
      }
      .rb-RETURNED {
        background: #dcfce7;
        color: #166534;
      }
      .rb-REJECTED {
        background: #fee2e2;
        color: #991b1b;
      }
      .rb-NONE,
      .rb-null {
        background: #f1f5f9;
        color: #475569;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.9rem;
        margin-bottom: 1.5rem;
      }
      th,
      td {
        text-align: left;
        padding: 8px 6px;
        border-bottom: 1px solid #e2e8f0;
      }
      .ship {
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 12px;
        margin-bottom: 1rem;
        background: #f8fafc;
      }
      .ship h3 {
        margin: 0 0 8px;
        font-size: 1rem;
      }
      .return-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        margin-top: 6px;
      }
      .return-row input {
        width: 64px;
        padding: 0.25rem;
        border-radius: 6px;
        border: 1px solid #cbd5e1;
      }
      .return-row input.reason {
        width: 180px;
      }
      .return-row button,
      .cancel-button {
        padding: 0.3rem 0.6rem;
        border-radius: 8px;
        border: none;
        background: #ea580c;
        color: #fff;
        cursor: pointer;
        font-size: 0.8rem;
      }
    `
  ]
})
export class OrderDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly orders = inject(OrderService);
  private readonly toast = inject(ToastService);

  readonly order = signal<OrderDetailResponse | null>(null);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly cancelling = signal(false);

  readonly returnQty = signal<Record<string, number>>({});
  readonly returnReason = signal<Record<string, string>>({});

  readonly formatMoney = formatMoney;

  private orderId = '';

  ngOnInit(): void {
    this.orderId = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
  }

  load(): void {
    if (!this.orderId) {
      this.error.set(true);
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.error.set(false);
    this.orders.getById(this.orderId).subscribe({
      next: (order) => {
        this.order.set(order);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      }
    });
  }

  badgeClass(status: string): string {
    const normalized = (status ?? '').toUpperCase();
    const known = new Set(['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']);
    const css = known.has(normalized) ? normalized : 'PENDING';
    return 'badge st-' + css;
  }

  returnBadgeClass(returnStatus: string | null | undefined): string {
    const normalized = (returnStatus ?? 'NONE').toUpperCase();
    if (normalized === 'REQUESTED') return 'badge rb-REQUESTED';
    if (normalized === 'RETURNED') return 'badge rb-RETURNED';
    if (normalized === 'REJECTED') return 'badge rb-REJECTED';
    return 'badge rb-NONE';
  }

  returnLabel(returnStatus: string | null | undefined): string {
    const normalized = (returnStatus ?? 'NONE').toUpperCase();
    if (normalized === 'REQUESTED') return 'Iade talebi';
    if (normalized === 'RETURNED') return 'Onaylandi';
    if (normalized === 'REJECTED') return 'Reddedildi';
    return '-';
  }

  canCancelOrder(status: string): boolean {
    const normalized = (status ?? '').toUpperCase();
    return normalized === 'PENDING' || normalized === 'PROCESSING';
  }

  canRequestReturn(item: OrderItemResponse, orderStatus: string): boolean {
    if (orderStatus !== 'DELIVERED') return false;
    const returnStatus = (item.returnStatus ?? 'NONE').toUpperCase();
    return returnStatus === 'NONE';
  }

  setQty(itemId: string, value: number): void {
    this.returnQty.set({ ...this.returnQty(), [itemId]: value });
  }

  setReason(itemId: string, value: string): void {
    this.returnReason.set({ ...this.returnReason(), [itemId]: value });
  }

  submitReturn(item: OrderItemResponse): void {
    const qty = this.returnQty()[item.orderItemId] ?? 1;
    const reason = (this.returnReason()[item.orderItemId] ?? '').trim();
    if (!reason) {
      this.toast.showError('Iade nedeni girin.');
      return;
    }
    if (qty < 1 || qty > item.quantity) {
      this.toast.showError('Gecersiz adet.');
      return;
    }
    this.orders.requestReturn(item.orderItemId, { returnedQuantity: qty, reason }).subscribe({
      next: () => {
        this.toast.showInfo('Iade talebi olusturuldu');
        this.load();
      },
      error: () => {}
    });
  }

  cancelOrder(): void {
    const currentOrder = this.order();
    if (!currentOrder || this.cancelling() || !this.canCancelOrder(currentOrder.status)) {
      return;
    }

    this.cancelling.set(true);
    this.orders.cancelOrder(currentOrder.orderId).subscribe({
      next: (updated) => {
        this.cancelling.set(false);
        this.order.set(updated);
        this.toast.showInfo('Siparis iptal edildi');
      },
      error: () => {
        this.cancelling.set(false);
        this.toast.showError('Siparis iptal edilemedi');
      }
    });
  }

  shortDate(value: string | null | undefined): string {
    return (value ?? '').slice(0, 10);
  }
}
