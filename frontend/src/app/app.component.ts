import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ToastService } from './core/notify/toast.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    @if (toast.message(); as m) {
      <div class="toast" [class.toast-error]="toast.variant() === 'error'">
        {{ m }}
        <button type="button" class="toast-close" (click)="toast.clear()" aria-label="Kapat">×</button>
      </div>
    }
    <main class="app-shell">
      <header class="app-header">
        <div>
          <p class="eyebrow">E-Commerce Analytics Platform</p>
          <h1>Project Shell</h1>
        </div>
      </header>

      <section class="app-content">
        <router-outlet />
      </section>
    </main>
  `,
  styles: [`
    .toast {
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 1000;
      max-width: min(420px, 92vw);
      padding: 12px 40px 12px 14px;
      border-radius: 10px;
      background: #0f172a;
      color: #f8fafc;
      font-size: 0.9rem;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.25);
    }
    .toast-error {
      background: #7f1d1d;
    }
    .toast-close {
      position: absolute;
      top: 6px;
      right: 8px;
      border: none;
      background: transparent;
      color: inherit;
      font-size: 1.25rem;
      cursor: pointer;
      line-height: 1;
    }
    .app-shell {
      min-height: 100vh;
      padding: 24px;
    }

    .app-header {
      margin-bottom: 24px;
    }

    .eyebrow {
      margin: 0 0 8px;
      color: #4b5563;
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    h1 {
      margin: 0;
      font-size: 2rem;
    }

    .app-content {
      background: #ffffff;
      border: 1px solid #dbe3f0;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 12px 40px rgba(15, 23, 42, 0.06);
    }
  `]
})
export class AppComponent {
  readonly toast = inject(ToastService);
}
