import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, forkJoin } from 'rxjs';

import { OrderService } from '../../../core/api/order.service';
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
      h2 {
        margin: 0 0 0.75rem;
      }
      .back {
        margin-bottom: 1rem;
      }
      .back a {
        color: #2563eb;
        text-decoration: none;
      }
      section {
        margin-bottom: 1.5rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid #e2e8f0;
      }
      h3 {
        margin: 0 0 10px;
        font-size: 1rem;
      }
      .grid2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        max-width: 520px;
      }
      label {
        display: block;
        font-size: 0.75rem;
        color: #64748b;
        margin-bottom: 4px;
      }
      select,
      input,
      textarea {
        width: 100%;
        padding: 0.4rem 0.5rem;
        border-radius: 8px;
        border: 1px solid #cbd5e1;
        box-sizing: border-box;
      }
      button {
        padding: 0.4rem 0.75rem;
        border-radius: 8px;
        border: none;
        background: #0f172a;
        color: #fff;
        cursor: pointer;
        margin-top: 8px;
        margin-right: 8px;
      }
      button.secondary {
        background: #475569;
      }
      button.danger {
        background: #b91c1c;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.85rem;
      }
      th,
      td {
        text-align: left;
        padding: 6px 4px;
        border-bottom: 1px solid #e2e8f0;
      }
      .rev {
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 10px;
        margin-bottom: 10px;
      }
      .rev h4 {
        margin: 0 0 6px;
        font-size: 0.9rem;
      }
      .meta {
        font-size: 0.8rem;
        color: #64748b;
      }
    `
  ]
})
export class CorporateOrderDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly orders = inject(OrderService);
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
        this.saving.set(false);
        this.toast.showInfo('İade kararı kaydedildi');
        this.load();
      },
      error: () => this.saving.set(false)
    });
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
