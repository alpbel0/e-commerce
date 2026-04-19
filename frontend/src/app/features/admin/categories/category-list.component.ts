import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AdminService } from '../../../core/api/admin.service';
import { CategoryService } from '../../../core/api/category.service';
import type { CategoryResponse } from '../../../core/models/category.models';
import { ToastService } from '../../../core/notify/toast.service';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-admin-category-list',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, LoadingSpinnerComponent, ErrorStateComponent, ConfirmDialogComponent],
  templateUrl: './category-list.component.html',
  styles: [
    `
      h2 {
        margin: 0 0 1rem;
      }
      .create {
        margin-bottom: 1.5rem;
        padding: 12px;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        max-width: 480px;
      }
      .row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-bottom: 8px;
      }
      label {
        display: block;
        font-size: 0.75rem;
        color: #64748b;
        margin-bottom: 4px;
      }
      input,
      textarea {
        width: 100%;
        padding: 0.35rem 0.45rem;
        border-radius: 8px;
        border: 1px solid #cbd5e1;
        box-sizing: border-box;
      }
      .check {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 8px 0;
      }
      button {
        padding: 0.4rem 0.75rem;
        border-radius: 8px;
        border: none;
        background: #0f172a;
        color: #fff;
        cursor: pointer;
        font-size: 0.85rem;
        margin-right: 6px;
      }
      button.warn {
        background: #b91c1c;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.85rem;
      }
      th,
      td {
        text-align: left;
        padding: 8px 6px;
        border-bottom: 1px solid #e2e8f0;
      }
      .inline {
        width: 100%;
        box-sizing: border-box;
        padding: 0.25rem 0.35rem;
        border-radius: 6px;
        border: 1px solid #cbd5e1;
      }
    `
  ]
})
export class AdminCategoryListComponent implements OnInit {
  private readonly categoriesApi = inject(CategoryService);
  private readonly admin = inject(AdminService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly items = signal<CategoryResponse[]>([]);
  readonly saving = signal(false);
  readonly deleteOpen = signal(false);
  readonly deleteTarget = signal<CategoryResponse | null>(null);

  readonly createForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
    displayOrder: [0, Validators.required],
    active: [true]
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.categoriesApi.list().subscribe({
      next: (response) => {
        this.loading.set(false);
        this.items.set(response.items);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      }
    });
  }

  create(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }
    const value = this.createForm.getRawValue();
    this.saving.set(true);
    this.admin
      .createCategory({
        name: value.name.trim(),
        description: value.description.trim() || null,
        displayOrder: value.displayOrder,
        parentId: null,
        active: value.active
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.createForm.reset({ name: '', description: '', displayOrder: 0, active: true });
          this.toast.showInfo('Kategori eklendi');
          this.load();
        },
        error: () => this.saving.set(false)
      });
  }

  patchField(category: CategoryResponse, field: 'name' | 'active', event: Event): void {
    const target = event.target as HTMLInputElement;
    if (field === 'name') {
      const name = target.value.trim();
      if (!name || name === category.name) return;
      this.pushPatch(category.id, { name });
      return;
    }
    const active = target.checked;
    if (active === category.active) return;
    this.pushPatch(category.id, { active });
  }

  private pushPatch(id: string, body: { name: string } | { active: boolean }): void {
    this.saving.set(true);
    this.admin.updateCategory(id, body).subscribe({
      next: (row) => {
        this.saving.set(false);
        this.items.update((list) => list.map((item) => (item.id === row.id ? row : item)));
        this.toast.showInfo('Kategori guncellendi');
      },
      error: () => this.saving.set(false)
    });
  }

  askDelete(category: CategoryResponse): void {
    this.deleteTarget.set(category);
    this.deleteOpen.set(true);
  }

  cancelDelete(): void {
    this.deleteOpen.set(false);
    this.deleteTarget.set(null);
  }

  confirmDelete(): void {
    const category = this.deleteTarget();
    if (!category) return;
    this.admin.deleteCategory(category.id).subscribe({
      next: () => {
        this.cancelDelete();
        this.toast.showInfo('Kategori silindi');
        this.load();
      },
      error: () => this.cancelDelete()
    });
  }
}
