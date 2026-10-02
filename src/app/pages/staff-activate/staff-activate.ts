import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SupabaseService } from '../../services/supabase';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-staff-activate',
  imports: [FormsModule, RouterLink],
  templateUrl: './staff-activate.html',
  styleUrl: './staff-activate.css',
})
export class StaffActivate implements OnInit {
  private db = inject(SupabaseService).client;
  private auth = inject(AuthService);
  private router = inject(Router);
  loading = signal(true);
  valid = signal(false);
  busy = signal(false);
  error = signal('');
  email = signal('');
  password = '';
  confirmation = '';
  async ngOnInit() {
    try {
      const {
        data: { user },
        error,
      } = await this.db.auth.getUser();
      if (error || !user)
        throw new Error('This invitation has expired or is invalid. Ask the owner for help.');
      await firstValueFrom(this.auth.me());
      this.email.set(user.email ?? '');
      this.valid.set(true);
    } catch (error) {
      this.error.set((error as { message?: string }).message ?? 'Unable to open invitation.');
    } finally {
      this.loading.set(false);
    }
  }
  async save() {
    if (this.busy() || !this.valid()) return;
    if (this.password.length < 8) {
      this.error.set('Choose a password with at least 8 characters.');
      return;
    }
    if (this.password !== this.confirmation) {
      this.error.set('The passwords do not match.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      const { error } = await this.db.auth.updateUser({ password: this.password });
      if (error) throw error;
      this.password = '';
      this.confirmation = '';
      const { admin } = await firstValueFrom(this.auth.me());
      await this.router.navigate([admin.role === 'admin' ? '/admin' : '/admin/orders']);
    } catch (error) {
      this.error.set((error as { message?: string }).message ?? 'Unable to set password.');
    } finally {
      this.busy.set(false);
    }
  }
}
