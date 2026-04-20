import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, forkJoin } from 'rxjs';

import { OrderService } from '../../../core/api/order.service';
import { PaymentService } from '../../../core/api/payment.service';
import { ReviewService } from '../../../core/api/review.service';
import { ShipmentService } from '../../../core/api/shipment.service';
import { ToastService } from '../../../core/notify/toast.service';
import type { OrderDetailResponse, OrderItemResponse } from '../../../core/models/order.models';
import type { ReviewDto } from '../../../core/models/review.models';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { formatMoney } from '../../../shared/util/money';

@Component({
  selector: 'app-corporate-order-detail',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, LoadingSpinnerComponent, ErrorStateComponent],
  templateUrl: './corporate-order-detail.component.html',
  styles: [
    `
      .order-page {
        max-width: 1040px;
        margin: 0 auto;
        padding-bottom: 48px;
      }

      .order-back { margin-bottom: 20px; }
      .order-back__link {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--clr-primary-600);
        text-decoration: none;
        padding: 6px 12px 6px 8px;
        border-radius: var(--radius-md);
        transition: background var(--trans-fast), color var(--trans-fast);
      }
      .order-back__link:hover {
        background: var(--clr-primary-50);
        color: var(--clr-primary-700);
      }

      .order-hero {
        background: linear-gradient(135deg, #fff 0%, var(--clr-slate-50, #f8fafc) 100%);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-xl);
        padding: 24px 28px;
        margin-bottom: 22px;
        box-shadow: var(--shadow-sm);
      }
      .order-hero__top {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 10px 14px;
        margin-bottom: 14px;
      }
      .order-hero__badge {
        font-size: 0.68rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--clr-primary-700);
        background: var(--clr-primary-100);
        padding: 4px 10px;
        border-radius: var(--radius-full);
      }
      .order-hero__title {
        margin: 0;
        font-size: 1.65rem;
        font-weight: 800;
        letter-spacing: -0.03em;
        color: var(--text-primary);
      }
      .order-hero__meta {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .order-chip {
        display: inline-flex;
        align-items: center;
        font-size: 0.8rem;
        font-weight: 600;
        padding: 6px 12px;
        border-radius: var(--radius-md);
        background: #fff;
        border: 1px solid var(--border-default);
        color: var(--text-secondary);
        max-width: 100%;
        word-break: break-word;
      }
      .order-chip--muted {
        font-weight: 500;
        color: var(--text-muted);
      }

      .order-grid {
        display: grid;
        gap: 16px;
        margin-bottom: 16px;
      }
      .order-grid--2 { grid-template-columns: repeat(2, 1fr); }
      .order-grid--3 { grid-template-columns: repeat(3, 1fr); }
      @media (max-width: 900px) {
        .order-grid--2 { grid-template-columns: 1fr; }
        .order-grid--3 { grid-template-columns: 1fr; }
      }

      .order-card {
        background: #fff;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        padding: 20px 22px;
        box-shadow: var(--shadow-sm);
      }
      .order-card--wide { grid-column: 1 / -1; }
      .order-card--muted {
        background: var(--clr-slate-50, #f8fafc);
        border-style: dashed;
      }
      .order-card__title {
        margin: 0 0 4px;
        font-size: 1rem;
        font-weight: 800;
        letter-spacing: -0.02em;
        color: var(--text-primary);
      }
      .order-card__hint {
        margin: 0 0 16px;
        font-size: 0.78rem;
        color: var(--text-muted);
        line-height: 1.45;
      }

      .order-form { margin: 0; }
      .order-field { margin-bottom: 0; }
      .order-field--mt { margin-top: 12px; }
      .order-field label {
        display: block;
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--text-muted);
        margin-bottom: 6px;
      }
      .order-input {
        width: 100%;
        box-sizing: border-box;
        height: 40px;
        padding: 0 12px;
        font-size: 0.875rem;
        border: 1.5px solid var(--border-default);
        border-radius: var(--radius-md);
        background: #fff;
        color: var(--text-primary);
        transition: border-color var(--trans-fast), box-shadow var(--trans-fast);
      }
      .order-input:focus {
        outline: none;
        border-color: var(--clr-primary-400, #38bdf8);
        box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.15);
      }
      select.order-input { cursor: pointer; }
      textarea.order-input {
        height: auto;
        min-height: 88px;
        padding: 10px 12px;
        resize: vertical;
        line-height: 1.5;
      }

      .order-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 16px;
      }
      .order-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 40px;
        padding: 0 18px;
        font-size: 0.82rem;
        font-weight: 700;
        border-radius: var(--radius-md);
        border: none;
        cursor: pointer;
        transition: transform var(--trans-fast), box-shadow var(--trans-fast), background var(--trans-fast);
      }
      .order-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
      .order-btn--sm { min-height: 34px; padding: 0 12px; font-size: 0.78rem; }
      .order-btn--primary {
        background: var(--clr-primary-600);
        color: #fff;
        box-shadow: 0 2px 8px rgba(2, 132, 199, 0.35);
      }
      .order-btn--primary:hover:not(:disabled) {
        background: var(--clr-primary-700);
        transform: translateY(-1px);
      }
      .order-btn--secondary {
        background: var(--clr-slate-100, #f1f5f9);
        color: var(--text-secondary);
        border: 1.5px solid var(--border-default);
      }
      .order-btn--secondary:hover:not(:disabled) {
        background: var(--clr-slate-200);
        border-color: var(--clr-slate-300);
      }
      .order-btn--danger {
        background: var(--clr-danger-600, #dc2626);
        color: #fff;
      }
      .order-btn--danger:hover:not(:disabled) {
        filter: brightness(1.05);
      }

      .order-empty {
        margin: 0;
        font-size: 0.875rem;
        color: var(--text-muted);
      }

      .order-table-wrap {
        border: 1px solid var(--border-default);
        border-radius: var(--radius-md);
        overflow: hidden;
        margin-top: 4px;
      }
      .order-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.875rem;
      }
      .order-table thead {
        background: var(--clr-slate-50, #f8fafc);
      }
      .order-table th {
        text-align: left;
        padding: 10px 14px;
        font-size: 0.68rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--text-muted);
        border-bottom: 1px solid var(--border-default);
      }
      .order-table td {
        padding: 12px 14px;
        border-bottom: 1px solid var(--clr-slate-100, #f1f5f9);
        color: var(--text-secondary);
        vertical-align: middle;
      }
      .order-table tbody tr:last-child td { border-bottom: none; }
      .order-table tbody tr:hover td { background: var(--clr-primary-50, #f0f9ff); }
      .order-table__num { text-align: center; width: 72px; font-weight: 700; color: var(--text-primary); }
      .order-table__title { font-weight: 600; color: var(--text-primary); }
      .order-table__actions {
        text-align: right;
        white-space: nowrap;
        width: 1%;
      }
      .order-table__actions .order-btn { margin: 0 0 0 6px; }
      .order-table__actions .order-btn:first-child { margin-left: 0; }

      .order-return {
        display: inline-block;
        font-size: 0.72rem;
        font-weight: 700;
        padding: 3px 8px;
        border-radius: var(--radius-full);
        background: #e0f2fe;
        color: #0369a1;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .order-return--none {
        background: var(--clr-slate-100);
        color: var(--text-muted);
      }

      .order-reviews { display: flex; flex-direction: column; gap: 14px; margin-top: 8px; }
      .order-review {
        border: 1px solid var(--border-default);
        border-radius: var(--radius-md);
        padding: 16px 18px;
        background: var(--clr-slate-50, #f8fafc);
      }
      .order-review__head {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px 12px;
        margin-bottom: 6px;
      }
      .order-review__title { font-weight: 800; font-size: 0.9rem; color: var(--text-primary); }
      .order-review__stars {
        font-size: 0.78rem;
        font-weight: 700;
        color: #ca8a04;
        background: #fef9c3;
        padding: 2px 8px;
        border-radius: var(--radius-full);
      }
      .order-review__meta { margin: 0 0 8px; font-size: 0.78rem; color: var(--text-muted); }
      .order-review__text { margin: 0; font-size: 0.85rem; line-height: 1.55; color: var(--text-secondary); }
      .order-review__reply {
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px dashed var(--border-default);
        font-size: 0.82rem;
        color: var(--text-secondary);
        line-height: 1.5;
      }
      .order-review__reply-label {
        display: block;
        font-size: 0.65rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--text-muted);
        margin-bottom: 4px;
      }
    `
  ]
})
export class CorporateOrderDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly orders = inject(OrderService);
  private readonly payments = inject(PaymentService);
  private readonly shipments = inject(ShipmentService);
  private readonly reviews = inject(ReviewService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly saving = signal(false);
  readonly order = signal<OrderDetailResponse | null>(null);
  readonly orderReviews = signal<ReviewDto[]>([]);
  readonly responseDrafts = signal<Record<string, string>>({});

  readonly formatMoney = formatMoney;

  readonly orderStatuses = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;
  readonly paymentStatuses = ['PENDING', 'PAID', 'FAILED', 'REFUNDED'] as const;
  readonly shipmentStatuses = [
    'PENDING',
    'PICKED',
    'IN_TRANSIT',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'FAILED',
    'RETURNED'
  ] as const;

  statusForm = this.fb.nonNullable.group({ status: ['PENDING', Validators.required] });
  paymentForm = this.fb.nonNullable.group({ paymentStatus: ['PENDING', Validators.required] });
  shipmentForm = this.fb.nonNullable.group({
    status: ['PENDING', Validators.required],
    trackingNumber: [''],
    carrierName: ['']
  });

  private orderId = '';

  backLink(): string {
    return this.router.url.startsWith('/admin/') ? '/admin/orders' : '/corporate/orders';
  }

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
      next: (o) => {
        this.loading.set(false);
        this.order.set(o);
        this.statusForm.patchValue({ status: o.status });
        this.paymentForm.patchValue({ paymentStatus: o.paymentStatus });
        if (o.shipment) {
          this.shipmentForm.patchValue({
            status: o.shipment.status,
            trackingNumber: o.shipment.trackingNumber ?? '',
            carrierName: o.shipment.carrierName ?? ''
          });
        }
        this.loadOrderReviews(o);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      }
    });
  }

  private loadOrderReviews(o: OrderDetailResponse): void {
    const pids = [...new Set(o.items.map((i) => i.productId))];
    if (pids.length === 0) {
      this.orderReviews.set([]);
      return;
    }
    forkJoin(pids.map((productId) => this.reviews.list({ productId, page: 0, size: 50 }))).subscribe({
      next: (pages) => {
        const oid = o.orderId;
        const merged: ReviewDto[] = [];
        const seen = new Set<string>();
        for (const p of pages) {
          for (const r of p.items) {
            if (r.orderId === oid && !seen.has(r.id)) {
              seen.add(r.id);
              merged.push(r);
            }
          }
        }
        this.orderReviews.set(merged);
      },
      error: () => this.orderReviews.set([])
    });
  }

  saveStatus(): void {
    const v = this.statusForm.getRawValue();
    this.patchOrder(this.orders.updateStatus(this.orderId, { status: v.status }));
  }

  savePayment(): void {
    const v = this.paymentForm.getRawValue();
    this.patchOrder(this.orders.updatePaymentStatus(this.orderId, { paymentStatus: v.paymentStatus }));
  }

  private patchOrder(req: Observable<OrderDetailResponse>): void {
    this.saving.set(true);
    req.subscribe({
      next: (detail) => {
        this.saving.set(false);
        this.order.set(detail);
        this.statusForm.patchValue({ status: detail.status });
        this.paymentForm.patchValue({ paymentStatus: detail.paymentStatus });
        if (detail.shipment) {
          this.shipmentForm.patchValue({
            status: detail.shipment.status,
            trackingNumber: detail.shipment.trackingNumber ?? '',
            carrierName: detail.shipment.carrierName ?? ''
          });
        }
        this.toast.showInfo('Sipariş güncellendi');
      },
      error: () => this.saving.set(false)
    });
  }

  saveShipment(): void {
    const sh = this.order()?.shipment;
    if (!sh || this.shipmentForm.invalid) {
      this.shipmentForm.markAllAsTouched();
      return;
    }
    const v = this.shipmentForm.getRawValue();
    this.saving.set(true);
    this.shipments
      .update(sh.shipmentId, {
        status: v.status,
        trackingNumber: v.trackingNumber.trim() || null,
        carrierName: v.carrierName.trim() || null
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.toast.showInfo('Kargo güncellendi');
          this.load();
        },
        error: () => this.saving.set(false)
      });
  }

  decideReturn(item: OrderItemResponse, status: 'RETURNED' | 'REJECTED'): void {
    this.saving.set(true);
    this.orders.updateReturnStatus(item.orderItemId, { status, note: null }).subscribe({
      next: () => {
        if (status === 'RETURNED' && this.canRefundWithStripe(item)) {
          this.refundStripeItem(item, 'Return approved');
          return;
        }
        this.saving.set(false);
        this.toast.showInfo('İade kararı kaydedildi');
        this.load();
      },
      error: () => this.saving.set(false)
    });
  }

  refundStripeItem(item: OrderItemResponse, reason = 'Customer return'): void {
    if (!this.canRefundWithStripe(item)) {
      this.toast.showError('Stripe refund sadece odenmis Stripe siparisleri icin kullanilir.');
      return;
    }
    this.saving.set(true);
    this.payments.createStripeRefund({ orderItemId: item.orderItemId, reason }).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.showInfo('Stripe refund olusturuldu');
        this.load();
      },
      error: () => this.saving.set(false)
    });
  }

  canRefundWithStripe(_item: OrderItemResponse): boolean {
    const o = this.order();
    return !!o && o.paymentMethod === 'STRIPE_CARD' && o.paymentStatus === 'PAID';
  }

  setDraft(reviewId: string, text: string): void {
    this.responseDrafts.update((d) => ({ ...d, [reviewId]: text }));
  }

  onDraftInput(reviewId: string, ev: Event): void {
    const v = (ev.target as HTMLTextAreaElement).value ?? '';
    this.setDraft(reviewId, v);
  }

  sendResponse(reviewId: string): void {
    const text = (this.responseDrafts()[reviewId] ?? '').trim();
    if (!text) {
      this.toast.showError('Yanıt metni girin.');
      return;
    }
    this.saving.set(true);
    this.reviews.addResponse(reviewId, { responseText: text }).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.showInfo('Yanıt gönderildi');
        this.responseDrafts.update((d) => {
          const n = { ...d };
          delete n[reviewId];
          return n;
        });
        const o = this.order();
        if (o) this.loadOrderReviews(o);
      },
      error: () => this.saving.set(false)
    });
  }

  canRespond(r: ReviewDto): boolean {
    return !r.responses || r.responses.length === 0;
  }

  shortDate(s: string): string {
    return (s ?? '').slice(0, 16).replace('T', ' ');
  }
}
