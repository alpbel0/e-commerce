import { Component, effect, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { AnalyticsService } from '../../../core/api/analytics.service';
import { CorporateContextService } from '../../../core/corporate/corporate-context.service';
import type { CorporateSummaryResponse, RankedProductResponse } from '../../../core/models/analytics.models';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { formatMoney } from '../../../shared/util/money';

@Component({
  selector: 'app-corporate-dashboard',
  standalone: true,
  imports: [LoadingSpinnerComponent, ErrorStateComponent, EmptyStateComponent],
  templateUrl: './dashboard.component.html',
  styles: [
    `
      h2 {
        margin: 0 0 1rem;
      }
      .kpis {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 12px;
        margin-bottom: 1.5rem;
      }
      .kpi {
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 12px 14px;
        background: #f8fafc;
      }
      .kpi label {
        display: block;
        font-size: 0.75rem;
        color: #64748b;
        margin-bottom: 4px;
      }
      .kpi strong {
        font-size: 1.15rem;
      }
      h3 {
        font-size: 1rem;
        margin: 0 0 10px;
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
    `
  ]
})
export class CorporateDashboardComponent {
  private readonly analytics = inject(AnalyticsService);
  readonly ctx = inject(CorporateContextService);

  readonly loading = signal(false);
  readonly error = signal(false);
  readonly summary = signal<CorporateSummaryResponse | null>(null);
  readonly topProducts = signal<RankedProductResponse[]>([]);

  readonly formatMoney = formatMoney;

  constructor() {
    effect(() => {
      const sid = this.ctx.selectedStoreId();
      if (!sid) {
        this.loading.set(false);
        this.error.set(false);
        this.summary.set(null);
        this.topProducts.set([]);
        return;
      }
      this.load(sid);
    });
  }

  load(storeId: string): void {
    this.loading.set(true);
    this.error.set(false);
    forkJoin({
      s: this.analytics.corporateSummary(storeId),
      t: this.analytics.corporateTopProducts(storeId, 8)
    }).subscribe({
      next: ({ s, t }) => {
        this.loading.set(false);
        this.summary.set(s);
        this.topProducts.set(t.items);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      }
    });
  }

  retry(): void {
    const sid = this.ctx.selectedStoreId();
    if (sid) this.load(sid);
  }
}
