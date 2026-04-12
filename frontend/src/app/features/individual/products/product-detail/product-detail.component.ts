import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { CartService } from '../../../../core/api/cart.service';
import { OrderService } from '../../../../core/api/order.service';
import { ProductService } from '../../../../core/api/product.service';
import { ReviewService } from '../../../../core/api/review.service';
import type { OrderSummaryResponse } from '../../../../core/models/order.models';
import type { ProductDetailResponse } from '../../../../core/models/product.models';
import type { ReviewDto } from '../../../../core/models/review.models';
import { ToastService } from '../../../../core/notify/toast.service';
import { ErrorStateComponent } from '../../../../shared/components/error-state/error-state.component';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { effectiveUnitPrice, formatMoney, starsFromRating } from '../../../../shared/util/money';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    ReactiveFormsModule,
    LoadingSpinnerComponent,
    ErrorStateComponent,
    PaginationComponent
  ],
  templateUrl: './product-detail.component.html',
  styles: [
    `
      .back {
        display: inline-block;
        margin-bottom: 1rem;
        color: #2563eb;
        text-decoration: none;
        font-size: 0.9rem;
      }
      .layout {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 24px;
      }
      @media (max-width: 800px) {
        .layout {
          grid-template-columns: 1fr;
        }
      }
      .gallery {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .gallery img {
        width: 100%;
        max-height: 320px;
        object-fit: contain;
        border-radius: 12px;
        border: 1px solid #e2e8f0;
        background: #f8fafc;
      }
      .thumbs {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }
      .thumbs img {
        width: 56px;
        height: 56px;
        object-fit: cover;
        border-radius: 8px;
        cursor: pointer;
        border: 2px solid transparent;
      }
      .thumbs img.active {
        border-color: #2563eb;
      }
      h1 {
        margin: 0 0 0.5rem;
        font-size: 1.35rem;
      }
      .sub {
        color: #64748b;
        font-size: 0.9rem;
        margin-bottom: 1rem;
      }
      .price-row {
        display: flex;
        align-items: baseline;
        gap: 10px;
        margin-bottom: 0.75rem;
      }
      .old {
        text-decoration: line-through;
        color: #94a3b8;
      }
      .price {
        font-size: 1.25rem;
        font-weight: 700;
      }
      .qty-row {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 1rem 0;
      }
      .qty-row input {
        width: 72px;
        padding: 0.4rem;
        border-radius: 8px;
        border: 1px solid #cbd5e1;
      }
      .qty-row button {
        padding: 0.5rem 1rem;
        border-radius: 8px;
        border: none;
        background: #2563eb;
        color: #fff;
        cursor: pointer;
      }
      .qty-row button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .tags span {
        display: inline-block;
        margin: 0 6px 6px 0;
        padding: 2px 8px;
        background: #f1f5f9;
        border-radius: 999px;
        font-size: 0.75rem;
      }
      .reviews {
        margin-top: 2rem;
        border-top: 1px solid #e2e8f0;
        padding-top: 1.5rem;
      }
      .reviews h2 {
        font-size: 1.1rem;
        margin: 0 0 1rem;
      }
      .rev {
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 12px;
        margin-bottom: 10px;
      }
      .rev .who {
        font-size: 0.8rem;
        color: #64748b;
      }
      .review-form {
        margin-top: 1.25rem;
        padding: 14px;
        background: #f8fafc;
        border-radius: 12px;
      }
      .review-form h3 {
        margin: 0 0 10px;
        font-size: 1rem;
      }
      .review-form .field {
        margin-bottom: 10px;
      }
      .review-form label {
        display: block;
        font-size: 0.8rem;
        margin-bottom: 4px;
        color: #475569;
      }
      .review-form input,
      .review-form select,
      .review-form textarea {
        width: 100%;
        max-width: 420px;
        padding: 0.45rem 0.55rem;
        border-radius: 8px;
        border: 1px solid #cbd5e1;
        box-sizing: border-box;
      }
      .review-form textarea {
        min-height: 80px;
        resize: vertical;
      }
      .review-form button {
        margin-top: 8px;
        padding: 0.45rem 1rem;
        border-radius: 8px;
        border: none;
        background: #0f172a;
        color: #fff;
        cursor: pointer;
      }
    `
  ]
})
export class ProductDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly products = inject(ProductService);
  private readonly reviews = inject(ReviewService);
  private readonly cart = inject(CartService);
  private readonly orders = inject(OrderService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  readonly product = signal<ProductDetailResponse | null>(null);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly imgIdx = signal(0);

  readonly reviewItems = signal<ReviewDto[]>([]);
  readonly reviewPage = signal(0);
  readonly reviewTotalPages = signal(0);
  readonly reviewsLoading = signal(false);

  readonly orderChoices = signal<OrderSummaryResponse[]>([]);

  readonly formatMoney = formatMoney;
  readonly effectivePrice = (p: ProductDetailResponse) =>
    effectiveUnitPrice(p.unitPrice, p.discountPercentage);
  readonly stars = (p: ProductDetailResponse) => starsFromRating(p.avgRating);
  readonly starString = (n: number) => '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n));
  readonly revStars = (r: ReviewDto) => '★'.repeat(r.starRating) + '☆'.repeat(Math.max(0, 5 - r.starRating));

  qty = 1;

  readonly reviewForm = this.fb.nonNullable.group({
    orderId: ['', Validators.required],
    starRating: [5, [Validators.required, Validators.min(1), Validators.max(5)]],
    reviewTitle: ['', [Validators.required, Validators.maxLength(120)]],
    reviewText: ['', [Validators.required, Validators.minLength(4)]]
  });

  private productId = '';

  ngOnInit(): void {
    this.productId = this.route.snapshot.paramMap.get('id') ?? '';
    if (!this.productId) {
      void this.router.navigate(['/app/products']);
      return;
    }
    this.loadProduct();
    this.loadReviews();
    this.loadOrderChoices();
  }

  loadProduct(): void {
    this.loading.set(true);
    this.error.set(false);
    this.products.getById(this.productId).subscribe({
      next: (p) => {
        this.product.set(p);
        this.loading.set(false);
        this.qty = 1;
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      }
    });
  }

  loadReviews(): void {
    this.reviewsLoading.set(true);
    this.reviews
      .list({ productId: this.productId, page: this.reviewPage(), size: 8, sort: 'createdAt,desc' })
      .subscribe({
        next: (res) => {
          this.reviewsLoading.set(false);
          this.reviewItems.set(res.items);
          this.reviewTotalPages.set(res.totalPages);
        },
        error: () => {
          this.reviewsLoading.set(false);
          this.reviewItems.set([]);
        }
      });
  }

  loadOrderChoices(): void {
    this.orders.list({ page: 0, size: 40, sort: 'orderDate,desc' }).subscribe({
      next: (res) => this.orderChoices.set(res.items),
      error: () => this.orderChoices.set([])
    });
  }

  setImg(i: number): void {
    this.imgIdx.set(i);
  }

  showDiscount(p: ProductDetailResponse): boolean {
    return parseFloat(p.discountPercentage || '0') > 0;
  }

  addToCart(): void {
    const p = this.product();
    if (!p || !p.active || p.stockQuantity <= 0) return;
    const q = Math.min(Math.max(1, this.qty), p.stockQuantity);
    this.cart.addItem({ productId: p.id, quantity: q }).subscribe({
      next: () => this.toast.showInfo('Sepete eklendi'),
      error: () => {}
    });
  }

  onReviewPage(p: number): void {
    this.reviewPage.set(p);
    this.loadReviews();
  }

  shortDate(s: string | null | undefined): string {
    return (s ?? '').slice(0, 10);
  }

  submitReview(): void {
    if (this.reviewForm.invalid || !this.product()) {
      this.reviewForm.markAllAsTouched();
      return;
    }
    const v = this.reviewForm.getRawValue();
    this.orders.getById(v.orderId).subscribe({
      next: (detail) => {
        const hasProduct = detail.items.some((i) => i.productId === this.productId);
        if (!hasProduct) {
          this.toast.showError('Bu siparişte bu ürün yok.');
          return;
        }
        this.reviews
          .create({
            orderId: v.orderId,
            productId: this.productId,
            starRating: v.starRating,
            reviewTitle: v.reviewTitle.trim(),
            reviewText: v.reviewText.trim()
          })
          .subscribe({
            next: () => {
              this.toast.showInfo('Yorum gönderildi');
              this.reviewForm.reset({ orderId: v.orderId, starRating: 5, reviewTitle: '', reviewText: '' });
              this.reviewPage.set(0);
              this.loadReviews();
              this.loadProduct();
            },
            error: () => {}
          });
      },
      error: () => this.toast.showError('Sipariş doğrulanamadı.')
    });
  }
}
