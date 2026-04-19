import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AdminService } from '../../../core/api/admin.service';
import type { AuditLogResponse } from '../../../core/models/admin.models';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-admin-audit-log-detail',
  standalone: true,
  imports: [RouterLink, LoadingSpinnerComponent, ErrorStateComponent],
  template: `
    <a routerLink="/admin/audit-logs" style="display:inline-block;margin-bottom:1rem;color:#2563eb;text-decoration:none"><- Audit loga don</a>
    @if (loading()) {
      <app-loading-spinner />
    } @else if (error()) {
      <app-error-state message="Audit detayi yuklenemedi." (retry)="load()" />
    } @else {
      @if (log(); as item) {
        <h2>{{ item.action }}</h2>
        <div class="grid">
          <div class="card"><strong>Zaman</strong><div>{{ item.createdAt }}</div></div>
          <div class="card"><strong>User ID</strong><div>{{ item.userId || '-' }}</div></div>
          <div class="card"><strong>Actor</strong><div>{{ item.actorUserEmail || '-' }}</div></div>
          <div class="card"><strong>Entity</strong><div>{{ item.entityType || '-' }}</div></div>
          <div class="card"><strong>Entity ID</strong><div>{{ item.entityId || '-' }}</div></div>
        </div>
        <pre class="details">{{ item.details }}</pre>
      }
    }
  `,
  styles: [`
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:16px 0}
    .card{border:1px solid #e2e8f0;border-radius:12px;padding:12px;background:#fff}
    .details{white-space:pre-wrap;background:#0f172a;color:#e2e8f0;padding:12px;border-radius:12px}
  `]
})
export class AdminAuditLogDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly admin = inject(AdminService);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly log = signal<AuditLogResponse | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      this.error.set(true);
      return;
    }
    this.loading.set(true);
    this.error.set(false);
    this.admin.getAuditLog(id).subscribe({
      next: (log) => {
        this.loading.set(false);
        this.log.set(log);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      }
    });
  }
}
