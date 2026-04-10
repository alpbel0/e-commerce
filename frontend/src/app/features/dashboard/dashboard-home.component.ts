import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section>
      <h2>Dashboard Shell</h2>
      <p>This starter shell defines the primary frontend entry points for the project.</p>

      <nav class="nav-grid">
        <a routerLink="/auth">Auth</a>
        <a routerLink="/admin">Admin</a>
        <a routerLink="/chat">Chat</a>
      </nav>
    </section>
  `,
  styles: [`
    .nav-grid {
      display: flex;
      gap: 12px;
      margin-top: 16px;
      flex-wrap: wrap;
    }

    a {
      color: #0f172a;
      text-decoration: none;
      border: 1px solid #cbd5e1;
      border-radius: 999px;
      padding: 10px 16px;
      background: #f8fafc;
    }
  `]
})
export class DashboardHomeComponent {}

