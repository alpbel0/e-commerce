import { Component, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { OrderService } from '../../../core/api/order.service';
import { CorporateContextService } from '../../../core/corporate/corporate-context.service';
import type { OrderSummaryResponse } from '../../../core/models/order.models';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { formatMoney } from '../../../shared/util/money';

@Component({
  selector: 'app-corporate-order-list',
  standalone: true,
  imports: [RouterLink, LoadingSpinnerComponent, ErrorStateComponent, EmptyStateComponent, PaginationComponent],
  templateUrl: './corporate-order-list.component.html',
  styles: [
    `
      h2 {
        margin: 0 0 0.5rem;
      }
      .hint {
        margin: 0 0 1rem;
        font-size: 0.85rem;
        color: #64748b;
      }
      .filters {
        margin-bottom: 1rem;
      }
      .filters select {
        padding: 0.4rem 0.6rem;
        border-radius: 8px;
        border: 1px solid #cbd5e1;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.88rem;
      }
      th,
      td {
        text-align: left;
        padding: 8px 6px;
        border-bottom: 1px solid #e2e8f0;
      }
      .badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 999px;
        font-size: 0.68rem;
        font-weight: 600;
        text-transform: uppercase;
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
      a {
        color: #2563eb;
        text-decoration: none;
      }
    `
  ]
})
export class CorporateOrderListComponent {
  private readonly orders = inject(OrderService);
  readonly ctx = inject(CorporateContextService);

  readonly loading = signal(false);
  readonly error = signal(false);
  readonly items = signal<OrderSummaryResponse[]>([]);
  readonly status = signal<string>('');
  readonly page = signal(0);
  readonly totalPages = signal(0);

  readonly formatMoney = formatMoney;
  readonly statusOptions = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;

  constructor() {
    effect(() => {
      const sid = this.ctx.selectedStoreId();
      const st = this.status();
      this.fetch(sid, st);
    });
  }

  private fetch(sid: string | null, st: string): void {
    if (!sid) {
      this.loading.set(false);
      this.items.set([]);
      this.page.set(0);
      this.totalPages.set(0);
      return;
    }
    this.loading.set(true);
    this.error.set(false);
    this.orders
      .list({
        page: this.page(),
        size: 20,
        sort: 'orderDate,desc',
        status: st || undefined,
        storeId: sid
      })
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          this.items.set(res.items);
          this.totalPages.set(res.totalPages);
        },
        error: () => {
          this.loading.set(false);
          this.error.set(true);
        }
      });
  }

  onStatusChange(ev: Event): void {
    const v = (ev.target as HTMLSelectElement).value;
    this.page.set(0);
    this.status.set(v);
  }

  onPageChange(page: number): void {
    this.page.set(page);
  }

  retry(): void {
    const sid = this.ctx.selectedStoreId();
    this.fetch(sid, this.status());
  }

  badgeClass(s: string): string {
    const k = (s ?? '').toUpperCase();
    const known = new Set(['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']);
    const cls = known.has(k) ? k : 'PENDING';
    return 'badge st-' + cls;
  }

  shortDate(s: string): string {
    return (s ?? '').slice(0, 16).replace('T', ' ');
  }
}
