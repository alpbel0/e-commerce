import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, map } from 'rxjs';

import { ProductService } from '../../../core/api/product.service';
import { ReviewService } from '../../../core/api/review.service';
import { CorporateContextService } from '../../../core/corporate/corporate-context.service';
import { ToastService } from '../../../core/notify/toast.service';
import type { ProductSummaryResponse } from '../../../core/models/product.models';
import type { ReviewDto } from '../../../core/models/review.models';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';

interface ReviewRow {
  productTitle: string;
  review: ReviewDto;
}

@Component({
  selector: 'app-review-management',
  standalone: true,
  imports: [FormsModule, LoadingSpinnerComponent, ErrorStateComponent, EmptyStateComponent],
  templateUrl: './review-management.component.html',
  styles: [
    `
      .rev-page { max-width: 800px; margin: 0 auto; padding-bottom: 40px; }

      .rev-header { margin-bottom: 22px; }
      .rev-header__title {
        margin: 0 0 6px;
        font-size: 1.5rem;
        font-weight: 800;
        letter-spacing: -0.03em;
        color: var(--text-primary);
      }
      .rev-header__sub {
        margin: 0;
        font-size: 0.875rem;
        color: var(--text-muted);
        line-height: 1.45;
      }

      .rev-toolbar {
        display: flex;
        flex-direction: column;
        gap: 14px;
        margin-bottom: 22px;
      }
      @media (min-width: 640px) {
        .rev-toolbar {
          flex-direction: row;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
      }

      .rev-search-wrap {
        position: relative;
        flex: 1;
        min-width: 0;
        max-width: 420px;
      }
      .rev-search-icon {
        position: absolute;
        left: 14px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--text-muted);
        pointer-events: none;
      }
      .rev-search {
        width: 100%;
        box-sizing: border-box;
        height: 44px;
        padding: 0 14px 0 42px;
        font-size: 0.875rem;
        border: 1.5px solid var(--border-default);
        border-radius: var(--radius-md);
        background: #fff;
        color: var(--text-primary);
        transition: border-color var(--trans-fast), box-shadow var(--trans-fast);
      }
      .rev-search:focus {
        outline: none;
        border-color: var(--clr-primary-400, #38bdf8);
        box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.12);
      }
      .rev-search::placeholder { color: var(--text-muted); }

      .rev-segments {
        display: inline-flex;
        padding: 4px;
        background: var(--clr-slate-100, #f1f5f9);
        border-radius: var(--radius-md);
        border: 1px solid var(--border-default);
        flex-shrink: 0;
      }
      .rev-seg {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        font-size: 0.8rem;
        font-weight: 700;
        border: none;
        border-radius: 8px;
        background: transparent;
        color: var(--text-secondary);
        cursor: pointer;
        transition: background var(--trans-fast), color var(--trans-fast);
      }
      .rev-seg--active {
        background: #fff;
        color: var(--clr-primary-700);
        box-shadow: var(--shadow-sm);
      }
      .rev-seg__count {
        font-size: 0.68rem;
        font-weight: 800;
        padding: 2px 7px;
        border-radius: var(--radius-full);
        background: var(--clr-slate-200);
        color: var(--text-muted);
      }
      .rev-seg--active .rev-seg__count {
        background: var(--clr-primary-100);
        color: var(--clr-primary-700);
      }

      .rev-empty-filter {
        text-align: center;
        padding: 28px 20px;
        border: 1px dashed var(--border-default);
        border-radius: var(--radius-lg);
        background: var(--clr-slate-50);
        color: var(--text-muted);
        font-size: 0.9rem;
      }
      .rev-link-btn {
        margin-top: 10px;
        padding: 6px 12px;
        font-size: 0.82rem;
        font-weight: 700;
        color: var(--clr-primary-600);
        background: none;
        border: none;
        cursor: pointer;
        text-decoration: underline;
      }

      .rev-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .rev-card {
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        padding: 18px 20px;
        background: #fff;
        box-shadow: var(--shadow-sm);
      }
      .rev-card__head {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px 14px;
        margin-bottom: 12px;
      }
      .rev-card__product {
        margin: 0;
        font-size: 1rem;
        font-weight: 800;
        letter-spacing: -0.02em;
        color: var(--text-primary);
        line-height: 1.35;
        flex: 1;
        min-width: 0;
      }
      .rev-pill {
        flex-shrink: 0;
        font-size: 0.65rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        padding: 4px 10px;
        border-radius: var(--radius-full);
      }
      .rev-pill--pending { background: #fef3c7; color: #b45309; }
      .rev-pill--done { background: #dcfce7; color: #166534; }

      .rev-card__meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px 12px;
        margin-bottom: 12px;
      }
      .rev-chip {
        font-size: 0.78rem;
        font-weight: 600;
        padding: 4px 10px;
        border-radius: var(--radius-md);
        background: var(--clr-slate-100);
        color: var(--text-secondary);
        max-width: 100%;
        word-break: break-all;
      }
      .rev-stars {
        display: flex;
        gap: 2px;
        font-size: 0.95rem;
        line-height: 1;
        letter-spacing: -2px;
      }
      .rev-star { color: var(--clr-slate-200, #e2e8f0); }
      .rev-star--on { color: #f59e0b; }
      .rev-summary {
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--text-muted);
        flex: 1 1 100%;
      }
      @media (min-width: 520px) {
        .rev-summary { flex: 0 1 auto; }
      }

      .rev-quote {
        margin: 0 0 16px;
        padding: 12px 14px;
        border-left: 3px solid var(--clr-primary-400, #38bdf8);
        background: var(--clr-slate-50, #f8fafc);
        border-radius: 0 var(--radius-md) var(--radius-md) 0;
        font-size: 0.9rem;
        line-height: 1.6;
        color: var(--text-secondary);
      }

      .rev-reply {
        padding-top: 4px;
        border-top: 1px solid var(--clr-slate-100);
      }
      .rev-reply__label {
        display: block;
        font-size: 0.68rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--text-muted);
        margin-bottom: 8px;
      }
      .rev-textarea {
        width: 100%;
        box-sizing: border-box;
        min-height: 88px;
        max-height: 200px;
        padding: 10px 12px;
        font-size: 0.875rem;
        line-height: 1.5;
        border: 1.5px solid var(--border-default);
        border-radius: var(--radius-md);
        resize: vertical;
        font-family: inherit;
        transition: border-color var(--trans-fast), box-shadow var(--trans-fast);
      }
      .rev-textarea:focus {
        outline: none;
        border-color: var(--clr-primary-400);
        box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.1);
      }
      .rev-reply__actions { margin-top: 12px; }
      .rev-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 40px;
        padding: 0 20px;
        font-size: 0.82rem;
        font-weight: 700;
        border-radius: var(--radius-md);
        border: none;
        cursor: pointer;
        transition: background var(--trans-fast), transform var(--trans-fast);
      }
      .rev-btn--primary {
        background: var(--clr-primary-600);
        color: #fff;
        box-shadow: 0 2px 8px rgba(2, 132, 199, 0.35);
      }
      .rev-btn--primary:hover {
        background: var(--clr-primary-700);
        transform: translateY(-1px);
      }

      .rev-existing {
        margin-top: 4px;
        padding: 12px 14px;
        border-radius: var(--radius-md);
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
      }
      .rev-existing__label {
        display: block;
        font-size: 0.65rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #166534;
        margin-bottom: 6px;
      }
      .rev-existing__text {
        margin: 0;
        font-size: 0.875rem;
        line-height: 1.55;
        color: #14532d;
      }
    `
  ]
})
export class ReviewManagementComponent {
  private readonly products = inject(ProductService);
  private readonly reviews = inject(ReviewService);
  private readonly toast = inject(ToastService);
  readonly ctx = inject(CorporateContextService);

  readonly loading = signal(false);
  readonly error = signal(false);
  readonly items = signal<ReviewRow[]>([]);
  readonly query = signal('');
  readonly drafts = signal<Record<string, string>>({});
  /** Arama + liste sekmesi: tümü | yanıt bekleyenler */
  readonly filterTab = signal<'all' | 'pending'>('all');
  readonly starIndices = [1, 2, 3, 4, 5] as const;

  constructor() {
    effect(() => {
      const storeId = this.ctx.selectedStoreId();
      if (!storeId) {
        this.items.set([]);
        return;
      }
      this.load(storeId);
    });
  }

  load(storeId: string): void {
    this.loading.set(true);
    this.error.set(false);
    this.products.list({ storeId, page: 0, size: 20, sort: 'title,asc' }).subscribe({
      next: (productPage) => {
        const products = productPage.items;
        if (products.length === 0) {
          this.loading.set(false);
          this.items.set([]);
          return;
        }
        const requests = products.map((product) => this.loadProductReviews(product));
        forkJoin(requests).subscribe({
          next: (rows) => {
            this.loading.set(false);
            this.items.set(rows.flat());
          },
          error: () => {
            this.loading.set(false);
            this.error.set(true);
          }
        });
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      }
    });
  }

  private loadProductReviews(product: ProductSummaryResponse) {
    return this.reviews
      .list({ productId: product.id, page: 0, size: 20, sort: 'createdAt,desc' })
      .pipe(
        map((page) =>
          page.items.map((review) => ({
            productTitle: product.title,
            review
          }))
        )
      );
  }

  pendingCount(): number {
    return this.items().filter((row) => this.canRespond(row.review)).length;
  }

  visibleItems(): ReviewRow[] {
    let rows = this.items();
    if (this.filterTab() === 'pending') {
      rows = rows.filter((row) => this.canRespond(row.review));
    }
    const query = this.query().trim().toLowerCase();
    if (!query) return rows;
    return rows.filter(
      (row) =>
        row.productTitle.toLowerCase().includes(query) ||
        row.review.userEmail.toLowerCase().includes(query) ||
        (row.review.reviewTitle && row.review.reviewTitle.toLowerCase().includes(query)) ||
        (row.review.reviewText && row.review.reviewText.toLowerCase().includes(query))
    );
  }

  setQuery(value: string): void {
    this.query.set(value);
  }

  setDraft(reviewId: string, value: string): void {
    this.drafts.update((current) => ({ ...current, [reviewId]: value }));
  }

  sendResponse(reviewId: string): void {
    const text = (this.drafts()[reviewId] ?? '').trim();
    if (!text) {
      this.toast.showError('Yanıt metni boş olamaz.');
      return;
    }
    this.reviews.addResponse(reviewId, { responseText: text }).subscribe({
      next: () => {
        this.toast.showInfo('Yanıt kaydedildi');
        const storeId = this.ctx.selectedStoreId();
        if (storeId) this.load(storeId);
      },
      error: () => {}
    });
  }

  canRespond(review: ReviewDto): boolean {
    return !review.responses || review.responses.length === 0;
  }
}
