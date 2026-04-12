import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <div class="shell">
      <div class="brand">E-Commerce Analytics</div>
      <div class="card">
        <router-outlet />
      </div>
    </div>
  `,
  styles: [
    `
      .shell {
        min-height: 60vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 24px 16px;
      }
      .brand {
        font-weight: 700;
        font-size: 1.15rem;
        color: #0f172a;
        margin-bottom: 20px;
        letter-spacing: 0.04em;
      }
      .card {
        width: 100%;
        max-width: 440px;
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        padding: 24px;
        box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
      }
    `
  ]
})
export class AuthLayoutComponent {}
