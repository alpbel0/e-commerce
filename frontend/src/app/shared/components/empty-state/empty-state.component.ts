import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="empty-state">
      <div class="empty-state__icon-wrap" aria-hidden="true">
        @if (icon) {
          <span class="empty-state__emoji">{{ icon }}</span>
        } @else {
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 12a9 9 0 1 1 18 0 9 9 0 0 1-18 0"/><path d="M12 8v4"/><path d="M12 16h.01"/>
          </svg>
        }
      </div>
      <h3 class="empty-state__title">{{ title }}</h3>
      @if (message) {
        <p class="empty-state__msg">{{ message }}</p>
      }
      @if (actionLabel && actionLink) {
        <a class="ec-btn ec-btn--primary empty-state__action" [routerLink]="actionLink">{{ actionLabel }}</a>
      }
    </div>
  `,
  styles: [`
    .empty-state {
      text-align: center;
      padding: 52px 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      animation: fadeInUp .3s ease both;
    }
    .empty-state__icon-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 64px;
      height: 64px;
      border-radius: var(--radius-xl);
      background: var(--clr-slate-100);
      color: var(--text-muted);
      margin-bottom: 8px;
    }
    .empty-state__emoji { font-size: 2rem; }
    .empty-state__title {
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0;
    }
    .empty-state__msg {
      font-size: 0.875rem;
      color: var(--text-muted);
      max-width: 320px;
      margin: 0;
    }
    .empty-state__action { margin-top: 8px; }
  `]
})
export class EmptyStateComponent {
  @Input() icon = '';
  @Input({ required: true }) title!: string;
  @Input() message = '';
  @Input() actionLabel = '';
  @Input() actionLink: string | string[] = '';
}
