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
      .toolbar {
        display: flex;
        gap: 12px;
        margin-bottom: 1rem;
        flex-wrap: wrap;
      }
      .toolbar input {
        padding: 0.4rem 0.55rem;
        border-radius: 8px;
        border: 1px solid #cbd5e1;
        min-width: 240px;
      }
      .review {
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 14px;
        margin-bottom: 12px;
        background: #fff;
      }
      .meta {
        color: #64748b;
        font-size: 0.82rem;
        margin-bottom: 8px;
      }
      textarea {
        width: 100%;
        min-height: 84px;
        padding: 0.5rem;
        border-radius: 8px;
        border: 1px solid #cbd5e1;
        box-sizing: border-box;
      }
      button {
        margin-top: 8px;
        padding: 0.45rem 0.8rem;
        border-radius: 8px;
        border: none;
        background: #0f172a;
        color: #fff;
        cursor: pointer;
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

  visibleItems(): ReviewRow[] {
    const query = this.query().trim().toLowerCase();
    return this.items().filter((row) => {
      if (!query) return true;
      return (
        row.productTitle.toLowerCase().includes(query) ||
        row.review.userEmail.toLowerCase().includes(query) ||
        row.review.reviewTitle.toLowerCase().includes(query)
      );
    });
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
      this.toast.showError('Yanit metni bos olamaz.');
      return;
    }
    this.reviews.addResponse(reviewId, { responseText: text }).subscribe({
      next: () => {
        this.toast.showInfo('Yanit kaydedildi');
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
