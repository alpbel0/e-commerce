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
      .card {
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 16px;
        background: #fff;
      }
      .back {
        display: inline-block;
        margin-bottom: 1rem;
        color: #2563eb;
        text-decoration: none;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 12px;
      }
      .item {
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 12px;
        background: #f8fafc;
      }
      h2 {
        margin: 0 0 1rem;
      }
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
