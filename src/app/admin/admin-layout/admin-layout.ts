import { Component, signal } from '@angular/core';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet
} from '@angular/router';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-admin-layout',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive
  ],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.css'
})
export class AdminLayout {
  isLoggingOut = signal(false);
  menuOpen = signal(false);
  isAdmin = signal(false);

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    this.authService.me().subscribe({
      next: ({ admin }) => this.isAdmin.set(admin.role === 'admin'),
      error: () => this.router.navigate(['/login'])
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