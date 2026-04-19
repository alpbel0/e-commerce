import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthStore } from '../../../../core/auth/auth.store';
import { CartService } from '../../../../core/api/cart.service';
import { OrderService } from '../../../../core/api/order.service';
import { ProductService } from '../../../../core/api/product.service';
import { ReviewService } from '../../../../core/api/review.service';
import { WishlistService } from '../../../../core/api/wishlist.service';
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
      .hero {
        width: 100%;
        max-height: 360px;
        min-height: 320px;
        object-fit: contain;
        border-radius: 12px;
        border: 1px solid #e2e8f0;
        background: #f8fafc;
      }
      .gallery-empty {
        min-height: 320px;
        border-radius: 12px;
        border: 1px solid #e2e8f0;
        background: linear-gradient(135deg, #eff6ff, #f8fafc);
        color: #94a3b8;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.95rem;
      }
      .thumbs button {
        padding: 0;
        border: none;
        background: transparent;
        cursor: pointer;
      }
      .thumbs img {
        width: 100%;
        max-width: 64px;
        height: 64px;
        object-fit: cover;
        border-radius: 8px;
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
        flex-wrap: wrap;
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
      .wishlist-btn {
        background: #fef2f2 !important;
        color: #ef4444 !important;
        border: 1px solid #fecaca !important;
        padding: 0.5rem 0.75rem !important;
      }
      .wishlist-btn:hover {
        background: #fee2e2 !important;
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
      .review-response {
        margin-top: 8px;
        padding: 8px 10px;
        border-radius: 8px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
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
      .review-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 8px;
      }
      .review-actions button {
        padding: 0.45rem 1rem;
        border-radius: 8px;
        border: none;
        background: #0f172a;
        color: #fff;
        cursor: pointer;
      }
      .review-actions button.secondary {
        background: #475569;
      }
      .review-actions button.warn {
        background: #b91c1c;
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
  private readonly wishlist = inject(WishlistService);
  private readonly authStore = inject(AuthStore);
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
  readonly editingReviewId = signal<string | null>(null);
  readonly deletingReviewId = signal<string | null>(null);
  readonly orderChoices = signal<OrderSummaryResponse[]>([]);

  readonly formatMoney = formatMoney;
  readonly effectivePrice = (product: ProductDetailResponse) =>
    effectiveUnitPrice(product.unitPrice, product.discountPercentage);
  readonly stars = (product: ProductDetailResponse) => starsFromRating(product.avgRating);
  readonly starString = (count: number) => '*'.repeat(count) + '-'.repeat(Math.max(0, 5 - count));
  readonly revStars = (review: ReviewDto) =>
    '*'.repeat(review.starRating) + '-'.repeat(Math.max(0, 5 - review.starRating));

  qty = 1;
  private productId = '';

  readonly reviewForm = this.fb.nonNullable.group({
    orderId: ['', Validators.required],
    starRating: [5, [Validators.required, Validators.min(1), Validators.max(5)]],
    reviewTitle: ['', [Validators.required, Validators.maxLength(120)]],
    reviewText: ['', [Validators.required, Validators.minLength(4)]]
  });

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
      next: (product) => {
        this.product.set(product);
        this.imgIdx.set(0);
        this.qty = 1;
        this.loading.set(false);
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
        next: (response) => {
          this.reviewItems.set(response.items);
          this.reviewTotalPages.set(response.totalPages);
          this.reviewsLoading.set(false);
        },
        error: () => {
          this.reviewItems.set([]);
          this.reviewTotalPages.set(0);
          this.reviewsLoading.set(false);
        }
      });
  }

  loadOrderChoices(): void {
    if (!this.authStore.isLoggedIn()) {
      this.orderChoices.set([]);
      return;
    }
    this.orders.list({ page: 0, size: 40, sort: 'orderDate,desc' }).subscribe({
      next: (response) => this.orderChoices.set(response.items),
      error: () => this.orderChoices.set([])
    });
  }

  setImg(index: number): void {
    this.imgIdx.set(index);
  }

  selectedImage(product: ProductDetailResponse): string | null {
    if (!product.imageUrls.length) {
      return null;
    }
    return product.imageUrls[this.imgIdx()] ?? product.imageUrls[0] ?? null;
  }

  showDiscount(product: ProductDetailResponse): boolean {
    return parseFloat(product.discountPercentage || '0') > 0;
  }

  addToCart(): void {
    const product = this.product();
    if (!product || !product.active || product.stockQuantity <= 0) {
      return;
    }
    if (!this.authStore.isLoggedIn()) {
      this.redirectToLogin();
      return;
    }
    const quantity = Math.min(Math.max(1, this.qty), product.stockQuantity);
    this.cart.addItem({ productId: product.id, quantity }).subscribe({
      next: () => this.toast.showInfo('Sepete eklendi'),
      error: () => this.toast.showError('Sepete eklenemedi')
    });
  }

  addToWishlist(): void {
    const product = this.product();
    if (!product) {
      return;
    }
    if (!this.authStore.isLoggedIn()) {
      this.redirectToLogin();
      return;
    }
    this.wishlist.addToWishlist(product.id).subscribe({
      next: () => this.toast.showInfo('Favorilere eklendi'),
      error: () => this.toast.showError('Favorilere eklenemedi')
    });
  }

  onReviewPage(page: number): void {
    this.reviewPage.set(page);
    this.loadReviews();
  }

  shortDate(value: string | null | undefined): string {
    return (value ?? '').slice(0, 10);
  }

  isLoggedIn(): boolean {
    return this.authStore.isLoggedIn();
  }

  canManageReview(review: ReviewDto): boolean {
    const currentUserId = this.authStore.currentUser()?.id;
    return !!currentUserId && currentUserId === review.userId;
  }

  startEditReview(review: ReviewDto): void {
    this.reviews.getById(review.id).subscribe({
      next: (freshReview) => {
        this.editingReviewId.set(freshReview.id);
        this.reviewForm.reset({
          orderId: freshReview.orderId,
          starRating: freshReview.starRating,
          reviewTitle: freshReview.reviewTitle,
          reviewText: freshReview.reviewText
        });
      },
      error: () => this.toast.showError('Yorum detayi yuklenemedi')
    });
  }

  cancelEditReview(): void {
    this.editingReviewId.set(null);
    this.reviewForm.reset({ orderId: '', starRating: 5, reviewTitle: '', reviewText: '' });
  }

  deleteReview(review: ReviewDto): void {
    if (!this.canManageReview(review) || this.deletingReviewId()) {
      return;
    }
    this.deletingReviewId.set(review.id);
    this.reviews.delete(review.id).subscribe({
      next: () => {
        this.deletingReviewId.set(null);
        if (this.editingReviewId() === review.id) {
          this.cancelEditReview();
        }
        this.toast.showInfo('Yorum silindi');
        this.loadReviews();
        this.loadProduct();
      },
      error: () => {
        this.deletingReviewId.set(null);
        this.toast.showError('Yorum silinemedi');
      }
    });
  }

  submitReview(): void {
    if (!this.authStore.isLoggedIn()) {
      this.redirectToLogin();
      return;
    }
    if (this.reviewForm.invalid || !this.product()) {
      this.reviewForm.markAllAsTouched();
      return;
    }

    const value = this.reviewForm.getRawValue();
    const editingReviewId = this.editingReviewId();

    if (editingReviewId) {
      this.reviews
        .update(editingReviewId, {
          starRating: value.starRating,
          reviewTitle: value.reviewTitle.trim(),
          reviewText: value.reviewText.trim()
        })
        .subscribe({
          next: () => {
            this.toast.showInfo('Yorum guncellendi');
            this.cancelEditReview();
            this.reviewPage.set(0);
            this.loadReviews();
            this.loadProduct();
          },
          error: () => this.toast.showError('Yorum guncellenemedi')
        });
      return;
    }

    this.orders.getById(value.orderId).subscribe({
      next: (detail) => {
        const hasProduct = detail.items.some((item) => item.productId === this.productId);
        if (!hasProduct) {
          this.toast.showError('Bu sipariste bu urun yok.');
          return;
        }
        this.reviews
          .create({
            orderId: value.orderId,
            productId: this.productId,
            starRating: value.starRating,
            reviewTitle: value.reviewTitle.trim(),
            reviewText: value.reviewText.trim()
          })
          .subscribe({
            next: () => {
              this.toast.showInfo('Yorum gonderildi');
              this.reviewForm.reset({ orderId: '', starRating: 5, reviewTitle: '', reviewText: '' });
              this.reviewPage.set(0);
              this.loadReviews();
              this.loadProduct();
            },
            error: () => this.toast.showError('Yorum gonderilemedi')
          });
      },
      error: () => this.toast.showError('Siparis dogrulanamadi.')
    });
  }

  private redirectToLogin(): void {
    void this.router.navigate(['/auth/login'], { queryParams: { returnUrl: `/app/products/${this.productId}` } });
  }
}
