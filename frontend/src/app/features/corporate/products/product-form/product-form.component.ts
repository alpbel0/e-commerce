import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { CategoryService } from '../../../../core/api/category.service';
import { ProductService } from '../../../../core/api/product.service';
import { CorporateContextService } from '../../../../core/corporate/corporate-context.service';
import { ToastService } from '../../../../core/notify/toast.service';
import type { CategoryResponse } from '../../../../core/models/category.models';
import { ErrorStateComponent } from '../../../../shared/components/error-state/error-state.component';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, LoadingSpinnerComponent, ErrorStateComponent],
  templateUrl: './product-form.component.html',
  styles: [
    `
      h2 {
        margin: 0 0 1rem;
      }
      .row-actions {
        display: flex;
        gap: 10px;
        align-items: center;
        margin-bottom: 1rem;
      }
      .row-actions a {
        color: #2563eb;
        font-size: 0.9rem;
      }
      .grid {
        display: grid;
        gap: 12px;
        max-width: 520px;
      }
      label {
        display: block;
        font-size: 0.8rem;
        color: #475569;
        margin-bottom: 4px;
      }
      input,
      textarea,
      select {
        width: 100%;
        padding: 0.45rem 0.55rem;
        border-radius: 8px;
        border: 1px solid #cbd5e1;
        box-sizing: border-box;
      }
      textarea {
        min-height: 72px;
        resize: vertical;
      }
      .hint {
        font-size: 0.8rem;
        color: #64748b;
        margin: 0 0 8px;
      }
      .check {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .check input {
        width: auto;
      }
      button {
        padding: 0.5rem 1rem;
        border-radius: 8px;
        border: none;
        background: #0f172a;
        color: #fff;
        cursor: pointer;
        margin-top: 8px;
      }
    `
  ]
})
export class ProductFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly products = inject(ProductService);
  private readonly categoriesApi = inject(CategoryService);
  readonly ctx = inject(CorporateContextService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal(false);
  readonly categories = signal<CategoryResponse[]>([]);
  readonly editMode = signal(false);
  private productId: string | null = null;

  readonly form = this.fb.nonNullable.group({
    sku: ['', [Validators.required, Validators.minLength(1)]],
    title: ['', Validators.required],
    description: [''],
    brand: [''],
    categoryId: ['', Validators.required],
    unitPrice: ['', [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
    discountPercentage: ['0', Validators.pattern(/^\d+(\.\d{1,2})?$/)],
    costOfProduct: [''],
    stockQuantity: [0, [Validators.required, Validators.min(0)]],
    imageUrlsText: [''],
    tagsText: [''],
    active: [true]
  });

  ngOnInit(): void {
    this.productId = this.route.snapshot.paramMap.get('id');
    this.editMode.set(!!this.productId);
    if (this.editMode()) {
      this.form.controls.sku.disable();
    }
    this.loadCategories(() => {
      if (this.productId) {
        this.loadProduct(this.productId);
      }
    });
  }

  private loadCategories(done?: () => void): void {
    this.categoriesApi.list().subscribe({
      next: (res) => {
        this.categories.set(res.items);
        done?.();
      },
      error: () => {
        this.error.set(true);
        done?.();
      }
    });
  }

  loadProduct(id: string): void {
    this.loading.set(true);
    this.error.set(false);
    this.products.getById(id).subscribe({
      next: (p) => {
        this.loading.set(false);
        const sid = this.ctx.selectedStoreId();
        if (sid && p.storeId !== sid) {
          this.error.set(true);
          return;
        }
        this.form.patchValue({
          sku: p.sku,
          title: p.title,
          description: p.description ?? '',
          brand: p.brand ?? '',
          categoryId: p.categoryId,
          unitPrice: p.unitPrice,
          discountPercentage: p.discountPercentage ?? '0',
          costOfProduct: p.costOfProduct ?? '',
          stockQuantity: p.stockQuantity,
          imageUrlsText: (p.imageUrls ?? []).join('\n'),
          tagsText: (p.tags ?? []).join(', '),
          active: p.active
        });
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      }
    });
  }

  retry(): void {
    if (this.productId) this.loadProduct(this.productId);
    else this.loadCategories();
  }

  private parseUrls(text: string): string[] | null {
    const lines = text
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    return lines.length ? lines : null;
  }

  private parseTags(text: string): string[] | null {
    const parts = text
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return parts.length ? parts : null;
  }

  submit(): void {
    const sid = this.ctx.selectedStoreId();
    if (!sid) {
      this.toast.showError('Mağaza seçin.');
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const discount = v.discountPercentage.trim() || '0';
    const costRaw = v.costOfProduct.trim();
    const cost = costRaw === '' ? null : costRaw;

    this.saving.set(true);

    if (this.editMode() && this.productId) {
      this.products
        .update(this.productId, {
          categoryId: v.categoryId,
          title: v.title.trim(),
          description: v.description.trim() || null,
          brand: v.brand.trim() || null,
          imageUrls: this.parseUrls(v.imageUrlsText),
          unitPrice: v.unitPrice.trim(),
          discountPercentage: discount,
          costOfProduct: cost,
          stockQuantity: Math.floor(Number(v.stockQuantity)),
          tags: this.parseTags(v.tagsText),
          active: v.active
        })
        .subscribe({
          next: () => {
            this.saving.set(false);
            this.toast.showInfo('Ürün güncellendi');
            void this.router.navigateByUrl('/corporate/products');
          },
          error: () => this.saving.set(false)
        });
      return;
    }

    this.products
      .create({
        storeId: sid,
        categoryId: v.categoryId,
        sku: v.sku.trim(),
        title: v.title.trim(),
        description: v.description.trim() || null,
        brand: v.brand.trim() || null,
        imageUrls: this.parseUrls(v.imageUrlsText),
        unitPrice: v.unitPrice.trim(),
        discountPercentage: discount,
        costOfProduct: cost,
        stockQuantity: Math.floor(Number(v.stockQuantity)),
        tags: this.parseTags(v.tagsText)
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.toast.showInfo('Ürün oluşturuldu');
          void this.router.navigateByUrl('/corporate/products');
        },
        error: () => this.saving.set(false)
      });
  }
}
