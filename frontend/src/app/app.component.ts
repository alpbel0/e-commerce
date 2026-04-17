import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ToastService } from './core/notify/toast.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    @if (toast.message(); as m) {
      <div class="toast" [class.toast--error]="toast.variant() === 'error'" role="alert">
        <div class="toast__content">
          @if (toast.variant() === 'error') {
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          } @else {
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          }
          <span>{{ m }}</span>
        </div>
        <button type="button" class="toast__close" (click)="toast.clear()" aria-label="Kapat">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    }
    <router-outlet />
  `,
  styles: [`
    :host { display: contents; }

    /* Toast */
    .toast {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      max-width: min(400px, calc(100vw - 40px));
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 14px;
      border-radius: var(--radius-lg);
      background: var(--clr-slate-900);
      color: #f8fafc;
      font-size: 0.875rem;
      font-weight: 500;
      box-shadow: var(--shadow-xl);
      animation: fadeInUp .25s ease both;
      border: 1px solid rgba(255,255,255,.1);
    }
    .toast--error { background: #7f1d1d; border-color: rgba(239,68,68,.3); }
    .toast__content {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .toast__close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border: none;
      background: rgba(255,255,255,.1);
      color: inherit;
      border-radius: var(--radius-sm);
      cursor: pointer;
      flex-shrink: 0;
      transition: background var(--trans-fast);
    }
    .toast__close:hover { background: rgba(255,255,255,.2); }
  `]
})
export class AppComponent {
  readonly toast = inject(ToastService);
}
