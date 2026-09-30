import { Injectable, inject } from '@angular/core';
import { defer } from 'rxjs';
import { SupabaseService } from './supabase';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private db = inject(SupabaseService).client;

  private async currentStaff() {
    const { data: { user }, error } = await this.db.auth.getUser();
    if (error) throw error;
    if (!user) throw new Error('Please sign in.');
    const { data: staff, error: staffError } = await this.db.from('staff')
      .select('user_id, name, role').eq('user_id', user.id).maybeSingle();
    if (staffError) throw staffError;
    if (!staff || !['admin', 'waiter'].includes(staff.role)) throw new Error('This account does not have staff access. Ask the owner to add your account to the staff table.');
    return { admin: { id: staff.user_id as string, username: staff.name as string, role: staff.role as 'admin' | 'waiter' } };
  }

  login(email: string, password: string) {
    return defer(async () => {
      const { error } = await this.db.auth.signInWithPassword({ email, password });
      if (error) throw error;
      try {
        return { ...await this.currentStaff(), message: 'Signed in.' };
      } catch (error) {
        await this.db.auth.signOut({ scope: 'local' });
        throw error;
      }
    });
  }

  me() { return defer(() => this.currentStaff()); }

  logout() {
    return defer(async () => {
      const { error } = await this.db.auth.signOut({ scope: 'local' });
      if (error) throw error;
      return { message: 'Signed out.' };
    });
  }
}
