import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
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
export class AppComponent {}
