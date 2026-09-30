import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from './auth';
import { SupabaseService } from './supabase';

describe('AuthService', () => {
  function setup(role: string | null) {
    const signInWithPassword = vi.fn().mockResolvedValue({ error: null });
    const signOut = vi.fn().mockResolvedValue({ error: null });
    const maybeSingle = vi.fn().mockResolvedValue({
      data: role ? { user_id: 'user-id', name: 'Owner', role } : null,
      error: null,
    });
    const client = {
      auth: {
        signInWithPassword,
        signOut,
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-id' } }, error: null }),
      },
      from: vi.fn().mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
    };
    TestBed.configureTestingModule({ providers: [
      AuthService, { provide: SupabaseService, useValue: { client } },
    ] });
    return { service: TestBed.inject(AuthService), signInWithPassword, signOut };
  }

  it('signs in an admin using email and password', async () => {
    const { service, signInWithPassword } = setup('admin');
    const result = await firstValueFrom(service.login('owner@example.com', 'password'));
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'owner@example.com', password: 'password' });
    expect(result.admin.id).toBe('user-id');
  });


  it('allows a waiter to sign in with a staff role', async () => {
    const { service } = setup('waiter');
    const result = await firstValueFrom(service.login('waiter@example.com', 'password'));
    expect(result.admin.role).toBe('waiter');
  });

  for (const role of [null]) {
    it(`rejects admin portal access for ${role ?? 'a customer'} and clears the session`, async () => {
      const { service, signOut } = setup(role);
      await expect(firstValueFrom(service.login('user@example.com', 'password'))).rejects.toThrow('does not have staff access');
      expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
    });
  }
});
