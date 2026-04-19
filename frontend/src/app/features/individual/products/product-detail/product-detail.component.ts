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
      /* Back link */
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

      /* Main layout */
      .layout {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 36px;
        background: #fff;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-xl);
        padding: 28px;
        box-shadow: var(--shadow-sm);
        margin-bottom: 28px;
      }
      @media (max-width: 800px) {
        .layout { grid-template-columns: 1fr; gap: 20px; padding: 20px; }
      }

      /* Gallery */
      .gallery { display: flex; flex-direction: column; gap: 10px; }
      .hero {
        width: 100%;
        height: 380px;
        object-fit: contain;
        border-radius: var(--radius-lg);
        border: 1px solid var(--border-default);
        background: var(--clr-slate-50);
      }
      .gallery-empty {
        height: 380px;
        border-radius: var(--radius-lg);
        border: 1.5px dashed var(--border-default);
        background: linear-gradient(135deg, var(--clr-primary-50), #f8fafc);
        color: var(--text-muted);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.9rem;
      }
      .thumbs { display: flex; gap: 8px; flex-wrap: wrap; }
      .thumbs button {
        padding: 0;
        border: none;
        background: transparent;
        cursor: pointer;
        border-radius: var(--radius-md);
        overflow: hidden;
      }
      .thumbs img {
        width: 64px;
        height: 64px;
        object-fit: cover;
        border-radius: var(--radius-md);
        border: 2.5px solid transparent;
        transition: border-color var(--trans-fast);
      }
      .thumbs img.active { border-color: var(--clr-primary-500); }

      /* Info panel */
      .info-panel { display: flex; flex-direction: column; gap: 12px; }
      h1 {
        margin: 0;
        font-size: 1.5rem;
        font-weight: 800;
        line-height: 1.3;
        color: var(--text-primary);
      }
      .sub {
        color: var(--text-muted);
        font-size: 0.875rem;
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }
      .sub-dot { color: var(--border-default); }

      /* Stars */
      .stars-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .star-icons { color: var(--clr-accent-500); font-size: 1rem; letter-spacing: 1px; }
      .review-link {
        font-size: 0.82rem;
        color: var(--clr-primary-600);
        font-weight: 500;
      }
      .stock-pill {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.75rem;
        font-weight: 600;
        padding: 3px 10px;
        border-radius: var(--radius-full);
      }
      .stock-pill--ok { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
      .stock-pill--out { background: #fef2f2; color: var(--clr-danger-600); border: 1px solid #fecaca; }

      /* Price */
      .price-row {
        display: flex;
        align-items: baseline;
        gap: 12px;
        flex-wrap: wrap;
      }
      .price {
        font-size: 1.85rem;
        font-weight: 900;
        color: var(--text-primary);
        letter-spacing: -.02em;
      }
      .old {
        text-decoration: line-through;
        color: var(--text-muted);
        font-size: 1rem;
      }
      .discount-tag {
        background: var(--clr-danger-500);
        color: #fff;
        font-size: 0.75rem;
        font-weight: 800;
        padding: 3px 9px;
        border-radius: var(--radius-full);
      }

      /* Tags */
      .tags { display: flex; flex-wrap: wrap; gap: 6px; }
      .tags span {
        padding: 3px 10px;
        background: var(--clr-slate-100);
        border-radius: var(--radius-full);
        font-size: 0.75rem;
        color: var(--text-secondary);
        font-weight: 500;
      }

      /* Description */
      .description {
        color: var(--text-secondary);
        font-size: 0.9rem;
        line-height: 1.7;
        background: var(--clr-slate-50);
        padding: 12px 14px;
        border-radius: var(--radius-md);
        border: 1px solid var(--border-default);
      }

      /* Add to cart row */
      .qty-row {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        padding-top: 8px;
        border-top: 1px solid var(--border-default);
      }
      .qty-label { font-size: 0.82rem; font-weight: 600; color: var(--text-secondary); }
      .qty-input {
        width: 70px;
        height: 42px;
        text-align: center;
        border: 1.5px solid var(--border-default);
        border-radius: var(--radius-md);
        font-size: 0.9rem;
        font-weight: 600;
        padding: 0 8px;
      }
      .btn-cart-main {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 0 24px;
        height: 42px;
        border-radius: var(--radius-md);
        border: none;
        background: var(--clr-primary-600);
        color: #fff;
        font-size: 0.9rem;
        font-weight: 700;
        cursor: pointer;
        transition: background var(--trans-fast), box-shadow var(--trans-fast);
      }
      .btn-cart-main:hover:not(:disabled) {
        background: var(--clr-primary-700);
        box-shadow: 0 4px 14px rgba(2,132,199,.4);
      }
      .btn-cart-main:disabled { opacity: .45; cursor: not-allowed; }
      .wishlist-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 42px;
        padding: 0 16px;
        border-radius: var(--radius-md);
        border: 1.5px solid #fecaca;
        background: #fef2f2;
        color: var(--clr-danger-500);
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        transition: all var(--trans-fast);
      }
      .wishlist-btn:hover { background: #fee2e2; border-color: #fca5a5; }
      .wishlist-btn:disabled { opacity: 0.55; cursor: wait; }
      .wishlist-btn--active {
        border-color: #f87171;
        background: #fff1f2;
        color: #dc2626;
      }
      .wishlist-heart path {
        fill: none;
        stroke: currentColor;
        transition: fill 0.15s ease, stroke 0.15s ease;
      }
      .wishlist-btn--active .wishlist-heart path {
        fill: #ff0000;
        stroke: #ff0000;
      }

      /* Reviews section */
      .reviews {
        background: #fff;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-xl);
        padding: 24px 28px;
        box-shadow: var(--shadow-sm);
      }
      .reviews h2 {
        font-size: 1.2rem;
        font-weight: 800;
        margin: 0 0 16px;
        color: var(--text-primary);
      }
      .rev {
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        padding: 14px 16px;
        margin-bottom: 12px;
        transition: box-shadow var(--trans-fast);
      }
      .rev:hover { box-shadow: var(--shadow-sm); }
      .rev .who {
        font-size: 0.8rem;
        color: var(--text-muted);
        margin: 4px 0 6px;
      }
      .rev p { color: var(--text-secondary); font-size: 0.875rem; line-height: 1.6; margin: 0; }
      .review-response {
        margin-top: 10px;
        padding: 10px 12px;
        border-radius: var(--radius-md);
        background: var(--clr-slate-50);
        border: 1px solid var(--border-default);
      }
      .review-response strong { font-size: 0.8rem; color: var(--text-secondary); }
      .review-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 10px;
      }
      .review-actions button {
        padding: 0.4rem 1rem;
        border-radius: var(--radius-md);
        border: none;
        background: var(--clr-slate-800);
        color: #fff;
        font-size: 0.82rem;
        font-weight: 600;
        cursor: pointer;
        transition: background var(--trans-fast);
      }
      .review-actions button:hover { background: var(--clr-slate-900); }
      .review-actions button.secondary {
        background: transparent;
        color: var(--text-secondary);
        border: 1.5px solid var(--border-default);
      }
      .review-actions button.secondary:hover { background: var(--clr-slate-50); }
      .review-actions button.warn {
        background: var(--clr-danger-500);
      }
      .review-actions button.warn:hover { background: var(--clr-danger-600); }

      /* Review form */
      .review-form {
        margin-top: 20px;
        padding: 20px;
        background: var(--clr-slate-50);
        border-radius: var(--radius-lg);
        border: 1px solid var(--border-default);
      }
      .review-form h3 {
        margin: 0 0 14px;
        font-size: 1rem;
        font-weight: 700;
      }
      .review-form .field { margin-bottom: 12px; }
      .review-form label {
        display: block;
        font-size: 0.8rem;
        font-weight: 600;
        margin-bottom: 5px;
        color: var(--text-secondary);
      }
      .review-form input,
      .review-form select,
      .review-form textarea {
        width: 100%;
        max-width: 480px;
        border: 1.5px solid var(--border-default);
        border-radius: var(--radius-md);
        background: #fff;
        font-size: 0.875rem;
        padding: 0.5rem 0.75rem;
      }
      .review-form textarea { min-height: 90px; resize: vertical; }
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
  /** Ürün şu an kullanıcının favori listesinde mi */
  readonly inWishlist = signal(false);
  readonly wishlistBusy = signal(false);

  readonly formatMoney = formatMoney;
  readonly effectivePrice = (product: ProductDetailResponse) =>
    effectiveUnitPrice(product.unitPrice, product.discountPercentage);
  readonly stars = (product: ProductDetailResponse) => starsFromRating(product.avgRating);
  readonly starString = (count: number) => '★'.repeat(count) + '☆'.repeat(Math.max(0, 5 - count));
  readonly revStars = (review: ReviewDto) =>
    '★'.repeat(review.starRating) + '☆'.repeat(Math.max(0, 5 - review.starRating));
  readonly discountPct = (product: ProductDetailResponse) =>
    Math.round(parseFloat(product.discountPercentage || '0'));

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
        this.syncWishlistState(product.id);
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

  toggleWishlist(): void {
    const product = this.product();
    if (!product || this.wishlistBusy()) {
      return;
    }
    if (!this.authStore.isLoggedIn()) {
      this.redirectToLogin();
      return;
    }
    this.wishlistBusy.set(true);
    if (this.inWishlist()) {
      this.wishlist.removeFromWishlist(product.id).subscribe({
        next: () => {
          this.inWishlist.set(false);
          this.wishlistBusy.set(false);
          this.toast.showInfo('Favorilerden çıkarıldı');
        },
        error: () => {
          this.wishlistBusy.set(false);
          this.toast.showError('Favorilerden çıkarılamadı');
        }
      });
      return;
    }
    this.wishlist.addToWishlist(product.id).subscribe({
      next: () => {
        this.inWishlist.set(true);
        this.wishlistBusy.set(false);
        this.toast.showInfo('Favorilere eklendi');
      },
      error: () => {
        this.wishlistBusy.set(false);
        this.toast.showError('Favorilere eklenemedi');
      }
    });
  }

  private syncWishlistState(productId: string): void {
    if (!this.authStore.isLoggedIn()) {
      this.inWishlist.set(false);
      return;
    }
    this.wishlist.getWishlist().subscribe({
      next: (items) => this.inWishlist.set(items.some((i) => i.id === productId)),
      error: () => this.inWishlist.set(false)
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
