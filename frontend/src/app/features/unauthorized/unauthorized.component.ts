import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [RouterLink],
  template: `
    <h2>Erişim reddedildi</h2>
    <p>Bu sayfayı görüntüleme yetkiniz yok.</p>
    <p><a routerLink="/auth/login">Giriş sayfasına dön</a></p>
  `
})
export class UnauthorizedComponent {}
