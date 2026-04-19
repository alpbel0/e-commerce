import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { CategoryService } from '../../../../core/api/category.service';
import { ProductService } from '../../../../core/api/product.service';
import { CorporateContextService } from '../../../../core/corporate/corporate-context.service';
import type { CategoryResponse } from '../../../../core/models/category.models';
import { ToastService } from '../../../../core/notify/toast.service';
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
      .preview-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
        gap: 8px;
        margin-top: 8px;
      }
      .preview-grid img {
        width: 100%;
        aspect-ratio: 1;
        object-fit: cover;
        border-radius: 10px;
        border: 1px solid #cbd5e1;
        background: #f8fafc;
      }
      .check {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .check input {
        width: auto;
      }
      .button-row {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
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
      button.secondary {
        background: #0f766e;
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
  readonly imageSaving = signal(false);
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

  readonly imageForm = this.fb.nonNullable.group({
    imageUrlsText: ['']
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
      next: (product) => {
        this.loading.set(false);
        const sid = this.ctx.selectedStoreId();
        if (sid && product.storeId !== sid) {
          this.error.set(true);
          return;
        }
        this.form.patchValue({
          sku: product.sku,
          title: product.title,
          description: product.description ?? '',
          brand: product.brand ?? '',
          categoryId: product.categoryId,
          unitPrice: product.unitPrice,
          discountPercentage: product.discountPercentage ?? '0',
          costOfProduct: product.costOfProduct ?? '',
          stockQuantity: product.stockQuantity,
          imageUrlsText: (product.imageUrls ?? []).join('\n'),
          tagsText: (product.tags ?? []).join(', '),
          active: product.active
        });
        this.imageForm.reset({ imageUrlsText: '' });
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

  previewImageUrls(): string[] {
    return this.parseUrls(this.form.controls.imageUrlsText.value) ?? [];
  }

  submit(): void {
    const sid = this.ctx.selectedStoreId();
    if (!sid) {
      this.toast.showError('Magaza secin.');
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const discount = value.discountPercentage.trim() || '0';
    const costRaw = value.costOfProduct.trim();
    const cost = costRaw === '' ? null : costRaw;

    this.saving.set(true);

    if (this.editMode() && this.productId) {
      this.products
        .patch(this.productId, {
          categoryId: value.categoryId,
          title: value.title.trim(),
          description: value.description.trim() || null,
          brand: value.brand.trim() || null,
          imageUrls: this.parseUrls(value.imageUrlsText),
          unitPrice: value.unitPrice.trim(),
          discountPercentage: discount,
          costOfProduct: cost,
          stockQuantity: Math.floor(Number(value.stockQuantity)),
          tags: this.parseTags(value.tagsText),
          active: value.active
        })
        .subscribe({
          next: () => {
            this.saving.set(false);
            this.toast.showInfo('Urun guncellendi');
            void this.router.navigateByUrl('/corporate/products');
          },
          error: () => {
            this.saving.set(false);
            this.toast.showError('Urun guncellenemedi');
          }
        });
      return;
    }

    this.products
      .create({
        storeId: sid,
        categoryId: value.categoryId,
        sku: value.sku.trim(),
        title: value.title.trim(),
        description: value.description.trim() || null,
        brand: value.brand.trim() || null,
        imageUrls: this.parseUrls(value.imageUrlsText),
        unitPrice: value.unitPrice.trim(),
        discountPercentage: discount,
        costOfProduct: cost,
        stockQuantity: Math.floor(Number(value.stockQuantity)),
        tags: this.parseTags(value.tagsText)
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.toast.showInfo('Urun olusturuldu');
          void this.router.navigateByUrl('/corporate/products');
        },
        error: () => {
          this.saving.set(false);
          this.toast.showError('Urun olusturulamadi');
        }
      });
  }

  addImages(): void {
    if (!this.productId || !this.editMode()) {
      return;
    }
    const imageUrls = this.parseUrls(this.imageForm.controls.imageUrlsText.value);
    if (!imageUrls?.length) {
      this.toast.showError('En az bir gorsel URL girin.');
      return;
    }

    this.imageSaving.set(true);
    this.products.addImages(this.productId, { imageUrls }).subscribe({
      next: (product) => {
        this.imageSaving.set(false);
        this.form.patchValue({
          imageUrlsText: (product.imageUrls ?? []).join('\n')
        });
        this.imageForm.reset({ imageUrlsText: '' });
        this.toast.showInfo('Gorseller eklendi');
      },
      error: () => {
        this.imageSaving.set(false);
        this.toast.showError('Gorseller eklenemedi');
      }
    });
  }
}
