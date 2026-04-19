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
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 20px;
        color: var(--text-secondary);
        text-decoration: none;
        font-size: 0.875rem;
        font-weight: 500;
        transition: color var(--trans-fast);
      }
      .back:hover { color: var(--clr-primary-600); }

      .order-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 12px;
        margin-bottom: 20px;
      }
      .order-id { font-size: 1.5rem; font-weight: 800; letter-spacing: -.02em; margin: 0; }
      .order-id span { font-family: monospace; color: var(--clr-primary-600); }

      .badge-row { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
      .badge {
        display: inline-block;
        padding: 3px 10px;
        border-radius: var(--radius-full);
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: .04em;
      }
      .st-PENDING    { background: #fef9c3; color: #854d0e; }
      .st-PROCESSING { background: #ffedd5; color: #9a3412; }
      .st-SHIPPED    { background: #dbeafe; color: #1e40af; }
      .st-DELIVERED  { background: #dcfce7; color: #166534; }
      .st-CANCELLED  { background: #fee2e2; color: #991b1b; }
      .rb-REQUESTED  { background: #fef9c3; color: #854d0e; }
      .rb-RETURNED   { background: #dcfce7; color: #166534; }
      .rb-REJECTED   { background: #fee2e2; color: #991b1b; }
      .rb-NONE, .rb-null { background: #f1f5f9; color: #475569; }

      .pay-text { font-size: 0.82rem; color: var(--text-muted); }

      /* Cards */
      .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
      @media (max-width: 640px) { .info-grid { grid-template-columns: 1fr; } }

      .info-card {
        background: #fff;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        padding: 16px;
        box-shadow: var(--shadow-sm);
      }
      .info-card__title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.8rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: .06em;
        color: var(--text-muted);
        margin-bottom: 10px;
        padding-bottom: 10px;
        border-bottom: 1px solid var(--border-default);
      }
      .info-card__title svg { color: var(--clr-primary-500); }
      .info-card p { margin: 4px 0; font-size: 0.875rem; color: var(--text-secondary); line-height: 1.6; }

      /* Shipment card */
      .ship {
        background: #fff;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        padding: 16px;
        margin-bottom: 16px;
        box-shadow: var(--shadow-sm);
      }
      .ship__title {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 12px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--border-default);
      }
      .ship__title-text { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--text-muted); }
      .ship__links { display: flex; gap: 8px; }
      .ship-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
      .ship-item strong { display: block; font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: .04em; margin-bottom: 2px; }
      .ship-item span { font-size: 0.875rem; color: var(--text-secondary); }

      /* Items table */
      .items-card { background: #fff; border: 1px solid var(--border-default); border-radius: var(--radius-lg); overflow: hidden; margin-bottom: 16px; box-shadow: var(--shadow-sm); }
      .items-card__header { padding: 14px 16px; border-bottom: 1px solid var(--border-default); background: var(--clr-slate-50); display: flex; align-items: center; gap: 8px; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--text-muted); }

      .return-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 8px; }
      .return-row input {
        height: 32px; padding: 0 8px;
        border: 1.5px solid var(--border-default);
        border-radius: var(--radius-md); font-size: 0.8rem;
      }
      .return-row input.qty { width: 64px; }
      .return-row input.reason { width: 180px; }
      .return-row button { padding: 0 12px; height: 32px; border-radius: var(--radius-md); border: none; background: #ea580c; color: #fff; font-size: 0.8rem; font-weight: 700; cursor: pointer; }

      .cancel-button {
        padding: 0 16px; height: 36px;
        border-radius: var(--radius-md);
        border: 1.5px solid #fca5a5;
        background: #fef2f2; color: var(--clr-danger-600);
        font-size: 0.85rem; font-weight: 700;
        cursor: pointer;
        transition: all var(--trans-fast);
      }
      .cancel-button:hover:not(:disabled) { background: #fee2e2; }
      .cancel-button:disabled { opacity: .55; cursor: not-allowed; }

      /* Total */
      .total-card { background: #fff; border: 1px solid var(--border-default); border-radius: var(--radius-lg); padding: 16px 20px; box-shadow: var(--shadow-sm); display: flex; justify-content: flex-end; }
      .total-value { font-size: 1.2rem; font-weight: 800; }

      a { color: var(--clr-primary-600); text-decoration: none; font-size: 0.82rem; font-weight: 600; }
      a:hover { text-decoration: underline; }
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
