import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgIf } from '@angular/common';
import { timeout } from 'rxjs';

import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-login',
  imports: [FormsModule, NgIf],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  username = '';
  password = '';

  errorMessage = signal('');
  successMessage = signal('');
  isLoading = signal(false);

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  login(): void {
    if (this.isLoading()) {
      return;
    }

    this.errorMessage.set('');
    this.successMessage.set('');

    if (!this.username.trim() || !this.password) {
      this.errorMessage.set('Email and password are required.');
      return;
    }

    this.isLoading.set(true);

    this.authService
      .login(this.username.trim(), this.password)
      .pipe(timeout(8000))
      .subscribe({
        next: (response) => {
          this.isLoading.set(false);
          this.successMessage.set(
            'Login successful. Redirecting...'
          );

          setTimeout(() => {
            this.router.navigate([response.admin.role === 'admin' ? '/admin' : '/admin/orders']);
          }, 1000);
        },

        error: (error) => {
          this.isLoading.set(false);

          if (error.status === 401) {
            this.errorMessage.set(
              'Invalid email or password.'
            );
            return;
          }

          if (error.status === 429) {
            this.errorMessage.set(
              'Too many login attempts. Please try again later.'
            );
            return;
          }

          if (error.name === 'TimeoutError') {
            this.errorMessage.set(
              'The server is taking too long to respond.'
            );
            return;
          }

          this.errorMessage.set(
            error.message ?? 'Unable to sign in. Please try again.'
          );
        }
      });
  }
}