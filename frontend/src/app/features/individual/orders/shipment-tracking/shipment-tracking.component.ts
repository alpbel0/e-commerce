import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { OrderService } from '../../../../core/api/order.service';
import { ShipmentService } from '../../../../core/api/shipment.service';
import type { ShipmentSummaryResponse } from '../../../../core/models/shipment.models';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/components/error-state/error-state.component';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-shipment-tracking',
  standalone: true,
  imports: [RouterLink, LoadingSpinnerComponent, ErrorStateComponent, EmptyStateComponent],
  templateUrl: './shipment-tracking.component.html',
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

      .tracking-card {
        background: #fff;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-xl);
        overflow: hidden;
        box-shadow: var(--shadow-sm);
      }
      .tracking-card__header {
        padding: 20px 24px;
        border-bottom: 1px solid var(--border-default);
        background: var(--clr-slate-50);
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .tracking-card__icon {
        width: 40px; height: 40px;
        background: var(--clr-primary-50);
        border-radius: var(--radius-md);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--clr-primary-600);
      }
      .tracking-card__title { font-size: 1.1rem; font-weight: 800; margin: 0; }
      .tracking-card__body { padding: 24px; }

      .info-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
      }
      .info-item {
        background: var(--clr-slate-50);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        padding: 14px 16px;
      }
      .info-item__label {
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: .08em;
        color: var(--text-muted);
        margin-bottom: 6px;
      }
      .info-item__value { font-size: 0.95rem; font-weight: 600; color: var(--text-primary); }
    `
  ]
})
export class ShipmentTrackingComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly orders = inject(OrderService);
  private readonly shipments = inject(ShipmentService);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly shipment = signal<ShipmentSummaryResponse | null>(null);
  readonly backLink = signal<string[]>(['/app/orders']);

  private orderId = '';
  private shipmentId = '';

  ngOnInit(): void {
    this.orderId = this.route.snapshot.paramMap.get('id') ?? '';
    this.shipmentId = this.route.snapshot.paramMap.get('shipmentId') ?? '';
    this.backLink.set(this.orderId ? ['/app/orders', this.orderId] : ['/app/orders']);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);

    if (this.shipmentId) {
      this.shipments.getById(this.shipmentId).subscribe({
        next: (shipment) => {
          this.loading.set(false);
          this.shipment.set(shipment);
        },
        error: () => {
          this.loading.set(false);
          this.error.set(true);
        }
      });
      return;
    }

    if (!this.orderId) {
      this.loading.set(false);
      this.error.set(true);
      return;
    }

    this.orders.getShipment(this.orderId).subscribe({
      next: (shipment) => {
        this.loading.set(false);
        this.shipment.set(shipment);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      }
    });
  }

  shortDate(value: string | null): string {
    return value ? value.replace('T', ' ').slice(0, 16) : '-';
  }
}
