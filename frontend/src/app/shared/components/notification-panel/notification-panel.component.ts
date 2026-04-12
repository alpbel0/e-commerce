import { Component, Input, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { NotificationService } from '../../../core/api/notification.service';
import type { NotificationResponse } from '../../../core/models/notification.models';
import { ErrorStateComponent } from '../error-state/error-state.component';
import { LoadingSpinnerComponent } from '../loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-notification-panel',
  standalone: true,
  imports: [RouterLink, LoadingSpinnerComponent, ErrorStateComponent],
  template: `
    <div class="wrap">
      <button type="button" class="bell" (click)="toggle()" aria-label="Bildirimler">
        🔔
        @if (unreadCount() > 0) {
          <span class="badge">{{ unreadCount() > 99 ? '99+' : unreadCount() }}</span>
        }
      </button>
      @if (panelOpen()) {
        <div class="panel" (click)="$event.stopPropagation()">
          <header>
            <span>Bildirimler</span>
            @if (unreadCount() > 0) {
              <button type="button" class="all-read" (click)="markAllRead($event)">Tümünü okundu</button>
            }
          </header>
          @if (loading()) {
            <app-loading-spinner />
          } @else if (loadError()) {
            <app-error-state message="Bildirimler yüklenemedi." (retry)="load()" />
          } @else if (items().length === 0) {
            <p class="empty">Bildirim yok</p>
          } @else {
            <ul>
              @for (n of items(); track n.id) {
                <li
                  [class.unread]="!n.read"
                  role="button"
                  tabindex="0"
                  (click)="onItemClick(n)"
                  (keyup.enter)="onItemClick(n)"
                >
                  <span class="t">{{ n.title }}</span>
                  <span class="m">{{ n.message }}</span>
                  @if (n.orderId && ordersLink) {
                    <a class="order" [routerLink]="ordersLink" (click)="$event.stopPropagation()">Sipariş</a>
                  }
                </li>
              }
            </ul>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .wrap {
        position: relative;
      }
      .bell {
        position: relative;
        border: none;
        background: #f1f5f9;
        border-radius: 10px;
        padding: 0.4rem 0.55rem;
        cursor: pointer;
        font-size: 1.1rem;
      }
      .badge {
        position: absolute;
        top: -4px;
        right: -4px;
        min-width: 18px;
        height: 18px;
        padding: 0 4px;
        border-radius: 999px;
        background: #dc2626;
        color: #fff;
        font-size: 0.65rem;
        line-height: 18px;
        text-align: center;
      }
      .panel {
        position: absolute;
        right: 0;
        top: calc(100% + 8px);
        width: min(340px, 90vw);
        max-height: 360px;
        overflow: auto;
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        box-shadow: 0 16px 40px rgba(15, 23, 42, 0.12);
        z-index: 50;
      }
      header {
        padding: 10px 12px;
        font-weight: 600;
        border-bottom: 1px solid #e2e8f0;
        font-size: 0.9rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .all-read {
        border: none;
        background: none;
        color: #2563eb;
        font-size: 0.75rem;
        cursor: pointer;
        padding: 0.2rem 0.35rem;
      }
      .all-read:hover {
        text-decoration: underline;
      }
      .empty {
        padding: 1rem;
        color: #64748b;
        font-size: 0.9rem;
        margin: 0;
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      li {
        padding: 10px 12px;
        border-bottom: 1px solid #f1f5f9;
        display: flex;
        flex-direction: column;
        gap: 4px;
        cursor: pointer;
      }
      li.unread {
        background: #eff6ff;
      }
      li:focus {
        outline: 2px solid #2563eb;
        outline-offset: -2px;
      }
      .t {
        font-weight: 600;
        font-size: 0.85rem;
      }
      .m {
        font-size: 0.8rem;
        color: #475569;
      }
      .order {
        font-size: 0.75rem;
        color: #2563eb;
      }
    `
  ]
})
export class NotificationPanelComponent implements OnDestroy, OnInit {
  private readonly notifications = inject(NotificationService);
  private sub: Subscription | null = null;

  @Input() ordersLink: string | string[] | null = '/app/orders';

  readonly panelOpen = signal(false);
  readonly loading = signal(false);
  readonly loadError = signal(false);
  readonly items = signal<NotificationResponse[]>([]);
  readonly unreadCount = signal(0);

  ngOnInit(): void {
    this.refreshUnreadBadge();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  toggle(): void {
    const next = !this.panelOpen();
    this.panelOpen.set(next);
    if (next) {
      this.load();
    }
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.sub?.unsubscribe();
    this.sub = this.notifications.listMine({ page: 0, size: 10 }).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.items.set(res.items);
        this.refreshUnreadBadge();
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      }
    });
  }

  onItemClick(n: NotificationResponse): void {
    if (n.read) return;
    this.notifications.markRead(n.id).subscribe({
      next: (updated) => {
        this.items.update((list) => list.map((x) => (x.id === updated.id ? updated : x)));
        this.refreshUnreadBadge();
      },
      error: () => {}
    });
  }

  markAllRead(ev: Event): void {
    ev.stopPropagation();
    this.notifications.markAllRead().subscribe({
      next: () => {
        this.items.update((list) =>
          list.map((x) => ({ ...x, read: true, readAt: x.readAt ?? new Date().toISOString() }))
        );
        this.unreadCount.set(0);
        this.refreshUnreadBadge();
      },
      error: () => {}
    });
  }

  /** Rozet: son 50 kayıttaki okunmamış sayısı */
  private refreshUnreadBadge(): void {
    this.notifications.listMine({ page: 0, size: 50 }).subscribe({
      next: (res) => {
        this.unreadCount.set(res.items.filter((x) => !x.read).length);
      },
      error: () => {
        this.unreadCount.set(0);
      }
    });
  }
}
