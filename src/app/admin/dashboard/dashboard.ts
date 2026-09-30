import { Component, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-dashboard',
  imports: [],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard {
  isLoggingOut = signal(false);
  username = signal('');

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    this.loadAdmin();
  }

  loadAdmin(): void {
    this.authService.me().subscribe({
      next: (response) => {
        this.username.set(response.admin.username);
      }
    });
  }

  logout(): void {
    if (this.isLoggingOut()) {
      return;
    }

    this.isLoggingOut.set(true);

    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },

      error: () => {
        this.isLoggingOut.set(false);
      }
    });
  }
}