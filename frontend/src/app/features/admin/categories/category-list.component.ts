import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { AdminService } from '../../../core/api/admin.service';
import { CategoryService } from '../../../core/api/category.service';
import { ToastService } from '../../../core/notify/toast.service';
import type { CategoryResponse } from '../../../core/models/category.models';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-admin-category-list',
  standalone: true,
  imports: [ReactiveFormsModule, LoadingSpinnerComponent, ErrorStateComponent, ConfirmDialogComponent],
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
      next: (res) => {
        this.loading.set(false);
        this.items.set(res.items);
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
    const v = this.createForm.getRawValue();
    this.saving.set(true);
    this.admin
      .createCategory({
        name: v.name.trim(),
        description: v.description.trim() || null,
        displayOrder: v.displayOrder,
        parentId: null,
        active: v.active
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

  patchField(c: CategoryResponse, field: 'name' | 'active', ev: Event): void {
    const el = ev.target as HTMLInputElement;
    if (field === 'name') {
      const name = el.value.trim();
      if (!name || name === c.name) return;
      this.pushPatch(c.id, { name });
      return;
    }
    const active = el.checked;
    if (active === c.active) return;
    this.pushPatch(c.id, { active });
  }

  private pushPatch(
    id: string,
    body: { name: string } | { active: boolean }
  ): void {
    this.saving.set(true);
    this.admin
      .updateCategory(id, body)
      .subscribe({
        next: (row) => {
          this.saving.set(false);
          this.items.update((list) => list.map((x) => (x.id === row.id ? row : x)));
          this.toast.showInfo('Güncellendi');
        },
        error: () => this.saving.set(false)
      });
  }

  askDelete(c: CategoryResponse): void {
    this.deleteTarget.set(c);
    this.deleteOpen.set(true);
  }

  cancelDelete(): void {
    this.deleteOpen.set(false);
    this.deleteTarget.set(null);
  }

  confirmDelete(): void {
    const c = this.deleteTarget();
    if (!c) return;
    this.admin.deleteCategory(c.id).subscribe({
      next: () => {
        this.cancelDelete();
        this.toast.showInfo('Kategori silindi');
        this.load();
      },
      error: () => this.cancelDelete()
    });
  }
}
