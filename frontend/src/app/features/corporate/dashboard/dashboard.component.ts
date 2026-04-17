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
  styles: [`
    .page-header { margin-bottom: 28px; }
    .page-header__title { font-size: 1.5rem; font-weight: 800; margin-bottom: 2px; }
    .page-header__sub { font-size: 0.875rem; color: var(--text-muted); }

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .kpi-card {
      background: var(--surface-card);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-lg);
      padding: 18px;
      display: flex;
      align-items: flex-start;
      gap: 14px;
      box-shadow: var(--shadow-sm);
      transition: box-shadow var(--trans-base), transform var(--trans-fast);
    }
    .kpi-card:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); }
    .kpi-card__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 42px;
      height: 42px;
      border-radius: var(--radius-md);
      flex-shrink: 0;
    }
    .kpi-card__icon--green  { background: #d1fae5; color: #059669; }
    .kpi-card__icon--blue   { background: #dbeafe; color: #1d4ed8; }
    .kpi-card__icon--purple { background: #ede9fe; color: #7c3aed; }
    .kpi-card__icon--amber  { background: #fef3c7; color: #d97706; }
    .kpi-card__icon--rose   { background: #ffe4e6; color: #e11d48; }
    .kpi-card__body { display: flex; flex-direction: column; gap: 2px; }
    .kpi-card__label { font-size: 0.72rem; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--text-muted); }
    .kpi-card__value { font-size: 1.35rem; font-weight: 800; color: var(--text-primary); line-height: 1.15; }

    .section-card { padding: 20px; }
    .section-card__title {
      display: flex;
      align-items: center;
      gap: 7px;
      font-size: 0.9rem;
      font-weight: 700;
      color: var(--text-secondary);
      margin-bottom: 16px;
    }
    .rank-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      background: var(--clr-slate-100);
      border-radius: 50%;
      font-size: 0.72rem;
      font-weight: 700;
      color: var(--text-secondary);
    }
    .product-name { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .revenue-cell { font-weight: 600; color: var(--text-primary); }
  `]
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
